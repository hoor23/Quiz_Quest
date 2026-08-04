// CONSTANTS
const CORRECT_BONUS = 10;
const MAX_QUESTIONS = 3;
const MAX_RETRIES = 3;

const question = document.getElementById("question");
const choices = Array.from(document.getElementsByClassName("choice-text"));
const progressText = document.getElementById('progressText');
const scoreText = document.getElementById('score');
const progressBarFull = document.getElementById('progressBarFull');
const loader = document.getElementById('loader');
const game = document.getElementById('game');

// This file is only meant for the quiz page. If it accidentally gets
// included on another page (like end.html) where these elements don't
// exist, stop here instead of throwing errors.
if (!question || !game || !loader) {
    console.warn("game.js: quiz elements not found on this page, skipping init.");
} else {

let currentQuestion = {};
let acceptingAnswers = false;
let score = 0;
let questionCounter = 0;
let availableQuestions = [];
let questions = [];

// ---------- Helpers ----------

// Decode HTML entities like &#039; &quot; &amp; so text shows correctly
function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

function saveState() {
    localStorage.setItem("quizState", JSON.stringify({
        questions,
        availableQuestions,
        currentQuestion,
        score,
        questionCounter
    }));
}

function loadState() {
    const savedState = JSON.parse(localStorage.getItem("quizState"));
    if (!savedState) return;

    questions = savedState.questions;
    availableQuestions = savedState.availableQuestions;
    currentQuestion = savedState.currentQuestion;
    score = savedState.score;
    questionCounter = savedState.questionCounter;

    scoreText.innerText = score;
    progressText.innerText = `Question ${questionCounter}/${MAX_QUESTIONS}`;
    progressBarFull.style.width = `${(questionCounter / MAX_QUESTIONS) * 100}%`;

    question.innerText = currentQuestion.question;
    choices.forEach(choice => {
        const number = choice.dataset.number;
        choice.innerText = currentQuestion["choice" + number];
    });

    acceptingAnswers = true;
}

function clearState() {
    localStorage.removeItem("quizState");
}

function incrementScore(num) {
    score += num;
    scoreText.innerText = score;
}

// ---------- Fetching (single implementation, with 429 retry) ----------

async function fetchQuestions(retryCount = 0) {
    try {
        const response = await fetch(
            "https://opentdb.com/api.php?amount=10&category=9&difficulty=easy&type=multiple",
            { cache: "no-store" }
        );

        if (!response.ok) {
            if (response.status === 429 && retryCount < MAX_RETRIES) {
                const waitTime = Math.pow(2, retryCount) * 1000;
                console.log(`Rate limited. Retrying in ${waitTime / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return fetchQuestions(retryCount + 1);
            }
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();

        if (data.response_code !== 0) {
            throw new Error("Trivia API returned an error.");
        }

        return data.results.map((loadedQuestion) => {
            const formattedQuestion = {
                question: decodeHtml(loadedQuestion.question),
            };

            const answerChoices = loadedQuestion.incorrect_answers.map(decodeHtml);
            formattedQuestion.answer = Math.floor(Math.random() * 4) + 1;

            answerChoices.splice(
                formattedQuestion.answer - 1,
                0,
                decodeHtml(loadedQuestion.correct_answer)
            );

            answerChoices.forEach((choice, index) => {
                formattedQuestion["choice" + (index + 1)] = choice;
            });

            return formattedQuestion;
        });

    } catch (error) {
        console.error(error);
        return [];
    }
}

// ---------- Game flow ----------

function startGame(loadSavedState = true) {
    if (loadSavedState) {
        const savedState = localStorage.getItem("quizState");
        if (savedState) {
            loadState();
            game.classList.remove("hidden");
            loader.classList.add("hidden");
            return;
        }
    }

    clearState();
    questionCounter = 0;
    score = 0;
    scoreText.innerText = score;
    availableQuestions = [...questions];

    getNewQuestion();

    loader.classList.add("hidden");
    game.classList.remove("hidden");
}

function getNewQuestion() {
    if (availableQuestions.length === 0 || questionCounter >= MAX_QUESTIONS) {
        clearState();
        localStorage.setItem("mostRecentScore", score);
        return window.location.assign("./end.html");
    }

    questionCounter++;

    progressText.innerText = `Question ${questionCounter}/${MAX_QUESTIONS}`;
    progressBarFull.style.width = `${(questionCounter / MAX_QUESTIONS) * 100}%`;

    const questionIndex = Math.floor(Math.random() * availableQuestions.length);
    currentQuestion = availableQuestions[questionIndex];

    question.innerText = currentQuestion.question;

    choices.forEach(choice => {
        const number = choice.dataset.number;
        choice.innerText = currentQuestion["choice" + number];
    });

    availableQuestions.splice(questionIndex, 1);
    acceptingAnswers = true;

    saveState();
}

choices.forEach(choice => {
    choice.addEventListener('click', e => {
        if (!acceptingAnswers) return;

        acceptingAnswers = false;
        const selectedChoice = e.target;
        const selectedAnswer = selectedChoice.dataset.number;
        const classToApply = selectedAnswer == currentQuestion.answer ? 'correct' : 'incorrect';

        if (classToApply === 'correct') {
            incrementScore(CORRECT_BONUS);
        }

        saveState();
        selectedChoice.parentElement.classList.add(classToApply);

        setTimeout(() => {
            selectedChoice.parentElement.classList.remove(classToApply);
            getNewQuestion();
        }, 1000);
    });
});

// ---------- Pause menu ----------

const pauseMenu = document.getElementById("pause-menu");
const menuIcon = document.querySelector('.menu-icon');
const resumeBtn = document.getElementById("resume");

if (menuIcon && pauseMenu) {
    menuIcon.addEventListener('click', () => pauseMenu.style.display = "flex");
}
if (resumeBtn && pauseMenu) {
    resumeBtn.addEventListener('click', () => pauseMenu.style.display = "none");
}

// ---------- Initialization ----------

(async () => {
    try {
        const savedState = localStorage.getItem("quizState");

        if (!savedState) {
            questions = await fetchQuestions();
            if (questions.length === 0) {
                alert("Unable to load questions. Please wait a minute and try again.");
                loader.classList.add("hidden");
                return;
            }
        }

        startGame();
    } catch (err) {
        console.error(err);
        alert("Something went wrong while starting the game.");
        loader.classList.add("hidden");
    }
})();

} // end guard: quiz elements exist
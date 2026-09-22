


/* =====================================================
   CONFIGURATION
===================================================== */

const API_URL = "https://opentdb.com/api.php";

const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 15;

const STORAGE_KEY = "quizmaster_leaderboard";


/* =====================================================
   APPLICATION STATE
===================================================== */

let questions = [];

let currentQuestionIndex = 0;

let score = 0;

let correctAnswers = 0;

let wrongAnswers = 0;

let selectedAnswer = null;

let timerInterval = null;

let timeLeft = TIME_PER_QUESTION;

let totalTimeTaken = 0;

let quizStartTime = null;

let playerName = "";

let difficulty = "medium";


/* =====================================================
   DOM ELEMENTS
===================================================== */

const homeScreen =
    document.getElementById("home-screen");

const quizScreen =
    document.getElementById("quiz-screen");

const resultScreen =
    document.getElementById("result-screen");

const leaderboardScreen =
    document.getElementById("leaderboard-screen");


const playerNameInput =
    document.getElementById("player-name");

const difficultySelect =
    document.getElementById("difficulty");


const startBtn =
    document.getElementById("start-btn");

const nextBtn =
    document.getElementById("next-btn");


const questionNumber =
    document.getElementById("question-number");

const questionElement =
    document.getElementById("question");

const categoryElement =
    document.getElementById("category");

const optionsContainer =
    document.getElementById("options");


const timerElement =
    document.getElementById("timer");

const progressBar =
    document.getElementById("progress-bar");

const answeredText =
    document.getElementById("answered-text");


const finalScore =
    document.getElementById("final-score");

const correctCount =
    document.getElementById("correct-count");

const wrongCount =
    document.getElementById("wrong-count");

const timeTakenElement =
    document.getElementById("time-taken");

const resultMessage =
    document.getElementById("result-message");


const leaderboardList =
    document.getElementById("leaderboard-list");

const emptyLeaderboard =
    document.getElementById("empty-leaderboard");


const loadingOverlay =
    document.getElementById("loading-overlay");


/* =====================================================
   SCREEN MANAGEMENT
===================================================== */

function showScreen(screen) {

    document.querySelectorAll(".screen").forEach(
        section => section.classList.remove("active")
    );

    screen.classList.add("active");
}


/* =====================================================
   START QUIZ
===================================================== */

startBtn.addEventListener("click", startQuiz);


async function startQuiz() {

    playerName =
        playerNameInput.value.trim();

    difficulty =
        difficultySelect.value;


    if (playerName === "") {

        alert("Please enter your name.");

        playerNameInput.focus();

        return;
    }


    showLoading(true);


    try {

        questions =
            await fetchQuestions();


        if (!questions.length) {

            throw new Error(
                "No questions received."
            );
        }


        currentQuestionIndex = 0;

        score = 0;

        correctAnswers = 0;

        wrongAnswers = 0;

        totalTimeTaken = 0;

        quizStartTime = Date.now();


        showScreen(quizScreen);

        displayQuestion();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to load quiz questions. " +
            "Please check your internet connection and try again."
        );

    } finally {

        showLoading(false);
    }
}


/* =====================================================
   FETCH QUESTIONS FROM REST API
===================================================== */

async function fetchQuestions() {

    const url =
        `${API_URL}?amount=${TOTAL_QUESTIONS}` +
        `&difficulty=${difficulty}` +
        `&type=multiple`;


    /*
        fetch() sends an asynchronous HTTP request.

        await pauses this function until the
        server responds without blocking the page.
    */

    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `HTTP Error: ${response.status}`
        );
    }


    const data =
        await response.json();


    if (data.response_code !== 0) {

        throw new Error(
            "API did not return valid questions."
        );
    }


    return data.results;
}


/* =====================================================
   DISPLAY QUESTION
===================================================== */

function displayQuestion() {

    clearInterval(timerInterval);


    const currentQuestion =
        questions[currentQuestionIndex];


    selectedAnswer = null;


    questionNumber.textContent =
        currentQuestionIndex + 1;


    categoryElement.textContent =
        decodeHTML(currentQuestion.category);


    questionElement.innerHTML =
        decodeHTML(currentQuestion.question);


    answeredText.textContent =
        "Select an answer";


    nextBtn.disabled = true;


    updateProgress();


    createOptions(currentQuestion);


    startTimer();
}


/* =====================================================
   CREATE ANSWER OPTIONS
===================================================== */

function createOptions(question) {

    optionsContainer.innerHTML = "";


    /*
        Combine correct answer and incorrect answers.
    */

    const answers = [

        question.correct_answer,

        ...question.incorrect_answers

    ];


    /*
        Randomly shuffle answers so that the
        correct answer does not always appear first.
    */

    shuffleArray(answers);


    answers.forEach(answer => {

        const button =
            document.createElement("button");


        button.className = "option";


        button.innerHTML =
            decodeHTML(answer);


        button.dataset.answer =
            answer;


        button.addEventListener(
            "click",
            () => selectAnswer(button, answer)
        );


        optionsContainer.appendChild(button);
    });
}


/* =====================================================
   SELECT ANSWER
===================================================== */

function selectAnswer(button, answer) {

    if (selectedAnswer !== null) {

        return;
    }


    selectedAnswer = answer;


    const currentQuestion =
        questions[currentQuestionIndex];


    const allOptions =
        document.querySelectorAll(".option");


    allOptions.forEach(option => {

        option.disabled = true;
    });


    /*
        Show selected option.
    */

    button.classList.add("selected");


    /*
        Check answer.
    */

    if (answer === currentQuestion.correct_answer) {

        score++;

        correctAnswers++;

        button.classList.add("correct");

        answeredText.textContent =
            "Correct answer!";

    } else {

        wrongAnswers++;

        button.classList.add("incorrect");

        answeredText.textContent =
            "Wrong answer!";


        /*
            Highlight the correct answer.
        */

        allOptions.forEach(option => {

            if (
                option.dataset.answer ===
                currentQuestion.correct_answer
            ) {

                option.classList.add("correct");
            }

        });
    }


    nextBtn.disabled = false;


    /*
        Stop timer after answer.
    */

    clearInterval(timerInterval);
}


/* =====================================================
   NEXT QUESTION
===================================================== */

nextBtn.addEventListener(
    "click",
    goToNextQuestion
);


function goToNextQuestion() {

    currentQuestionIndex++;


    if (
        currentQuestionIndex >=
        questions.length
    ) {

        finishQuiz();

        return;
    }


    displayQuestion();
}


/* =====================================================
   TIMER
===================================================== */

function startTimer() {

    timeLeft = TIME_PER_QUESTION;


    timerElement.textContent =
        timeLeft;


    timerElement.parentElement
        .classList.remove("warning");


    timerInterval =
        setInterval(() => {

            timeLeft--;


            timerElement.textContent =
                timeLeft;


            if (timeLeft <= 5) {

                timerElement.parentElement
                    .classList.add("warning");
            }


            if (timeLeft <= 0) {

                clearInterval(timerInterval);

                handleTimeUp();
            }

        }, 1000);
}


/* =====================================================
   TIME UP
===================================================== */

function handleTimeUp() {

    const currentQuestion =
        questions[currentQuestionIndex];


    /*
        If user hasn't selected an answer,
        count it as wrong.
    */

    if (selectedAnswer === null) {

        wrongAnswers++;

        answeredText.textContent =
            "Time's up!";


        const allOptions =
            document.querySelectorAll(".option");


        allOptions.forEach(option => {

            option.disabled = true;


            if (
                option.dataset.answer ===
                currentQuestion.correct_answer
            ) {

                option.classList.add("correct");
            }

        });


        nextBtn.disabled = false;
    }
}


/* =====================================================
   PROGRESS BAR
===================================================== */

function updateProgress() {

    const progress =
        (
            (currentQuestionIndex + 1)
            / questions.length
        ) * 100;


    progressBar.style.width =
        `${progress}%`;
}


/* =====================================================
   FINISH QUIZ
===================================================== */

function finishQuiz() {

    clearInterval(timerInterval);


    totalTimeTaken =
        Math.floor(
            (Date.now() - quizStartTime) / 1000
        );


    /*
        Save result in localStorage.
    */

    saveScore();


    /*
        Display result.
    */

    finalScore.textContent =
        score;


    correctCount.textContent =
        correctAnswers;


    wrongCount.textContent =
        wrongAnswers;


    timeTakenElement.textContent =
        `${totalTimeTaken}s`;


    resultMessage.textContent =
        getResultMessage();


    showScreen(resultScreen);
}


/* =====================================================
   RESULT MESSAGE
===================================================== */

function getResultMessage() {

    const percentage =
        (score / TOTAL_QUESTIONS) * 100;


    if (percentage === 100) {

        return "Perfect score! Excellent work.";

    }

    if (percentage >= 80) {

        return "Great performance! Keep it up.";

    }

    if (percentage >= 60) {

        return "Good job! There is room to improve.";

    }

    if (percentage >= 40) {

        return "Nice attempt! Practice will help.";

    }

    return "Keep practicing and try again!";
}


/* =====================================================
   LOCAL STORAGE - SAVE SCORE
===================================================== */

function saveScore() {

    /*
        Get existing scores from localStorage.

        If no data exists, use an empty array.
    */

    const leaderboard =
        getLeaderboard();


    const newEntry = {

        name: playerName,

        score: score,

        correct: correctAnswers,

        wrong: wrongAnswers,

        time: totalTimeTaken,

        difficulty: difficulty,

        date: new Date().toLocaleDateString()

    };


    leaderboard.push(newEntry);


    /*
        Sort highest score first.

        If scores are equal, the faster
        completion time appears first.
    */

    leaderboard.sort((a, b) => {

        if (b.score !== a.score) {

            return b.score - a.score;
        }

        return a.time - b.time;
    });


    /*
        Keep only the top 10 players.
    */

    const topScores =
        leaderboard.slice(0, 10);


    /*
        Convert JavaScript object/array into
        JSON and store it in localStorage.
    */

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(topScores)
    );
}


/* =====================================================
   LOCAL STORAGE - GET LEADERBOARD
===================================================== */

function getLeaderboard() {

    const storedData =
        localStorage.getItem(STORAGE_KEY);


    if (!storedData) {

        return [];
    }


    try {

        return JSON.parse(storedData);

    } catch (error) {

        console.error(
            "Invalid leaderboard data",
            error
        );

        return [];
    }
}


/* =====================================================
   DISPLAY LEADERBOARD
===================================================== */

function displayLeaderboard() {

    const leaderboard =
        getLeaderboard();


    leaderboardList.innerHTML = "";


    if (leaderboard.length === 0) {

        emptyLeaderboard.style.display =
            "block";

        return;
    }


    emptyLeaderboard.style.display =
        "none";


    leaderboard.forEach((entry, index) => {

        const row =
            document.createElement("div");


        row.className =
            "leaderboard-row";


        row.innerHTML = `

            <span class="rank">
                #${index + 1}
            </span>

            <span class="player">
                ${escapeHTML(entry.name)}
            </span>

            <span class="score">
                ${entry.score}/10
            </span>

            <span class="date">
                ${entry.date}
            </span>

        `;


        leaderboardList.appendChild(row);
    });
}


/* =====================================================
   VIEW LEADERBOARD
===================================================== */

document
    .getElementById("view-leaderboard-btn")
    .addEventListener(
        "click",
        () => {

            displayLeaderboard();

            showScreen(leaderboardScreen);
        }
    );


/* =====================================================
   RESULT -> LEADERBOARD
===================================================== */

document
    .getElementById("result-leaderboard-btn")
    .addEventListener(
        "click",
        () => {

            displayLeaderboard();

            showScreen(leaderboardScreen);
        }
    );


/* =====================================================
   PLAY AGAIN
===================================================== */

document
    .getElementById("play-again-btn")
    .addEventListener(
        "click",
        () => {

            showScreen(homeScreen);
        }
    );


/* =====================================================
   BACK HOME
===================================================== */

document
    .getElementById("back-home-btn")
    .addEventListener(
        "click",
        () => {

            showScreen(homeScreen);
        }
    );


/* =====================================================
   RESET LEADERBOARD
===================================================== */

document
    .getElementById("reset-leaderboard-btn")
    .addEventListener(
        "click",
        () => {

            const confirmed =
                confirm(
                    "Are you sure you want to delete the leaderboard?"
                );


            if (!confirmed) {

                return;
            }


            localStorage.removeItem(
                STORAGE_KEY
            );


            displayLeaderboard();
        }
    );


/* =====================================================
   LOADING
===================================================== */

function showLoading(show) {

    if (show) {

        loadingOverlay.classList.add("active");

    } else {

        loadingOverlay.classList.remove("active");
    }
}


/* =====================================================
   SHUFFLE ARRAY
===================================================== */

function shuffleArray(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );


        [
            array[i],
            array[j]
        ] = [
            array[j],
            array[i]
        ];
    }


    return array;
}


/* =====================================================
   DECODE HTML ENTITIES
===================================================== */

function decodeHTML(text) {

    const textarea =
        document.createElement("textarea");


    textarea.innerHTML = text;


    return textarea.value;
}


/* =====================================================
   ESCAPE USER-GENERATED HTML
===================================================== */

function escapeHTML(text) {

    const div =
        document.createElement("div");


    div.textContent = text;


    return div.innerHTML;
}


/* =====================================================
   INITIALIZATION
===================================================== */

showScreen(homeScreen);

console.log(
    "QuizMaster initialized successfully."
);

console.log(
    "REST API: Open Trivia Database"
);

console.log(
    "Storage Key:",
    STORAGE_KEY
);


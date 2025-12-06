// =================================================================
// 1. IMPORTS AND CONFIGURATION
// =================================================================
import express from "express"; 
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; 

const app = express(); 
const PORT = 3000; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.locals.siteTitle = "Weekly Task Tracker";
app.locals.flashMessage = null;

function loadData() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'tasks.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {
            lists: {
                "LIST A (House Chores)": [
                    { id: "def1a", name: "Wash Dishes", completed: false },
                    { id: "def2a", name: "Fold Laundry", completed: false }
                ],
                "LIST B (Yard & Pets)": [
                    { id: "def1b", name: "Mow Lawn", completed: false },
                    { id: "def2b", name: "Water Plants", completed: false }
                ],
            }
        };
    }
}

function saveData(data) {
    try {
        const json = JSON.stringify(data, null, 2);
        fs.writeFileSync(path.join(__dirname, 'tasks.json'), json, 'utf8');
    } catch (error) {
        console.error(`Error saving data to tasks.json: ${error}`);
    }
}

let dataStorage = loadData();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

// =================================================================
// 2. MIDDLEWARE
// =================================================================

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const currentHour = new Date().getHours();
    let greeting;
    if (currentHour >= 5 && currentHour < 12) greeting = "Good Morning";
    else if (currentHour >= 12 && currentHour < 18) greeting = "Good Afternoon";
    else greeting = "Good Evening";
    res.locals.greeting = greeting; 
    next();
});

app.use((req, res, next) => {
    let totalLists = 0;
    let totalTasks = 0;
    for (const listName in dataStorage.lists) {
        totalLists++;
        totalTasks += dataStorage.lists[listName].length; 
    }
    res.locals.totalLists = totalLists; 
    res.locals.totalTasks = totalTasks;
    next();
});

app.use((req, res, next) => {
    res.locals.flashMessage = app.locals.flashMessage;
    app.locals.flashMessage = null; 
    next();
});

app.use((req, res, next) => {
    if (req.body && req.body.entry) {
        req.body.entry = req.body.entry.replace(/<[^>]*>/g, '').trim(); 
    }
    next();
});

app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// =================================================================
// 3. EJS RENDERING ROUTES
// =================================================================

app.get("/", (req, res) => {
    const allTasks = [];
    for (const listName in dataStorage.lists) {
        dataStorage.lists[listName].forEach(taskObject => {
            allTasks.push({ ...taskObject, listName: listName });
        });
    }
    res.render("home", { 
        pageTitle: "Weekly Snapshot", 
        activePage: "home", 
        allTasks: allTasks 
    });
});

app.get("/All-Lists", async (req, res) => {
    res.render("all-list", { 
        pageTitle: "All Task Lists", 
        activePage: "all-lists", 
        lists: dataStorage.lists 
    });
});

app.get("/faq", (req, res) => {
    res.render("faq", { 
        pageTitle: "Frequently Asked Questions", 
        activePage: "faq" 
    });
});

app.get("/new-task", (req, res) => {
    res.render("new-task", { 
        pageTitle: "Add New Task", 
        activePage: "new-task",
        listKeys: Object.keys(dataStorage.lists) 
    });
});

// =================================================================
// 4. API & UTILITY ROUTES
// =================================================================

app.get("/time", (req, res) => {
    res.send(`Request time: ${req.requestTime}`);
});

app.get("/api/hello", (req, res) => {
    res.json({ message: "Good Morning", emoji: "🌅" });
});

// =================================================================
// 5. POST/FORM ROUTES
// =================================================================

app.post("/add", (req, res) => {
    const taskName = req.body.entry;
    const listKey = req.body.list;
    const taskId = Date.now().toString(36); // Unique ID

    if (dataStorage.lists[listKey]) {
        dataStorage.lists[listKey].push({
            id: taskId,
            name: taskName,
            completed: false 
        });
        saveData(dataStorage); 
        app.locals.flashMessage = `Task "${taskName}" added to ${listKey}!`;
    } else {
        app.locals.flashMessage = `Error: List ${listKey} not found.`;
    }
    res.redirect("/All-Lists"); 
});

app.post("/delete-task", (req, res) => {
    const taskId = req.body.taskId;
    const listKey = req.body.listKey;

    if (dataStorage.lists[listKey]) {
        dataStorage.lists[listKey] = dataStorage.lists[listKey].filter(task => task.id !== taskId);
        saveData(dataStorage);
        app.locals.flashMessage = `Task deleted.`;
    }
    res.redirect("/All-Lists"); 
});

// 🔑 NEW: Route to handle task completion
app.post("/complete-task", (req, res) => {
    const taskId = req.body.taskId;
    const listKey = req.body.listKey;
    const isCompleted = req.body.completed === 'true'; 

    if (dataStorage.lists[listKey]) {
        dataStorage.lists[listKey] = dataStorage.lists[listKey].map(task => {
            if (task.id === taskId) task.completed = isCompleted;
            return task;
        });
        saveData(dataStorage);
    }
    // No redirect needed if using fetch, but for forms we redirect
    res.redirect("/");
});

// =================================================================
// 5.5 Test Routes
// =================================================================
    
app.get("/trigger-500", (req, res, next) => {
  next(new Error("Intentional test error"));
});

// =================================================================
// 6. 404, 500 & SERVER LISTENER
// =================================================================

app.use((req, res) => {
    res.status(404).render("404", { 
        pageTitle: "Page Not Found",
        activePage: "404"
    });
});

app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === "production";
  const status = err.status || 500;

  console.error(`[ERROR] ${status} ${req.method} ${req.url}`, err.message);

  res.status(status).render("500", {
    pageTitle: "Server Error",
    activePage: "error",
    message: isProd ? "Something went wrong." : (err.message || "Error"),
    stack: isProd ? null : err.stack
  });
});

app.listen(PORT, () => { 
    console.log(`Server running at http://localhost:${PORT}`); 
});
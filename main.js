
/*
      ____                    ____   _______      __
     / __ \                  / __ \ / ____\ \    / /
    | |  | |_ __   ___ _ __ | |  | | (___  \ \  / / 
    | |  | | '_ \ / _ \ '_ \| |  | |\___ \  \ \/ /  
    | |__| | |_) |  __/ | | | |__| |____) |  \  /   
     \____/| .__/ \___|_| |_|\____/|_____/    \/    
           | |                                      
           |_|                                      
   
    OpenOSV v0.1.5
    RustからNode.jsにした
*/

const openosv_version = "0.1.5";

// Web
const express = require('express');
const bodyParser = require('body-parser');


// ID生成
const seedrandom = require('seedrandom');

// ファイル
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const app = express();

// 処理
function render(text) {
    
    text = text.replace(/!Img:\"(.+)\"/g, "<img src=\"$1\">")
    text = text.replace(/\n/g, "<br>");
    return text

}

function parse(text, thread) {

    var lock_command = /!lock/;
    
    if ( lock_command.test(text) ) {
        thread.ended = true
        setInterval(()=>{
            thread = JSON.parse(fs.readFileSync(`./BBS/${thread.id}.json`));
            thread.ended = false
            fs.writeFileSync(`./BBS/${thread.id}.json`, JSON.stringify(thread));

        }, 30000)
    }

    return (text, thread)
}

function generate_random_userid(seed) {
    const length = 8;
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rng_ = seedrandom(seed)
    let result = "";

    for (let i = 0; i < length; i++) {
        const rndIndex = Math.floor(rng_() * characters.length);
        result = result + characters[rndIndex];
    }
    return result;
}

function generate_random_threadid() {
    const length = 10;
    const characters = '0123456789';
    let result = "";

    for (let i = 0; i < length; i++) {
        const rndIndex = Math.floor(Math.random() * characters.length);
        result = result + characters[rndIndex];
    }
    return result;
}

function escapeHtml(html) {
    return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function thread_list_get() {
    const results = [];

    // ディレクトリ内のファイルを取得
    const files = fs.readdirSync("BBS");

    files.forEach(file => {
        const filePath = path.join("BBS", file);

        // ファイルの統計情報を取得
        const stat = fs.statSync(filePath);

        // JSONファイルの場合のみ読み込む
        if (stat && stat.isFile() && file.endsWith(".json")) {
            const data = fs.readFileSync(filePath, "utf-8");
            try {
                const jsonData = JSON.parse(data);
                results.push(jsonData);
            } catch (error) {
                console.error(`Error parsing JSON from file ${file}:`, error);
            }
        }
    });

    return results;
}



app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));


app.use(bodyParser.urlencoded({ extended: true })); // URLエンコードされたデータを解析
app.use(bodyParser.json()); // JSONデータを解析

app.get("/", (req, res) => {
    console.log("/");
    thread_list = thread_list_get();
    res.render("index", { version: openosv_version, thread_list: thread_list});
});

app.get("/thread/:id", (req, res) => {
    console.log("/thread/:id");
    try {
        var data = fs.readFileSync(`./BBS/${req.params.id}.json`);
        var thread = JSON.parse(data);
        var id = generate_random_userid(req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown')

        ctx = {
            thread: thread,
            render: render,
            locked: thread.ended,
            id: id
        }
        res.render('thread', ctx);        
    } catch ( err ) {
        res.render('error', { text: "スレッドがない"});
    }
});

app.get("/get/:id", (req, res) => {
    console.log("/get/:id");
    var old_data = JSON.parse(fs.readFileSync(`./BBS/${req.params.id}.json`));
    var new_data = JSON.parse(fs.readFileSync(`./BBS/${req.params.id}.json`));
    var i = setInterval(()=>{
        new_data = JSON.parse(fs.readFileSync(`./BBS/${req.params.id}.json`));
        if ( old_data.contents.length < new_data.contents.length ) {

            data = new_data.contents[new_data.contents.length-1];
            data.text = render(data.text);

            res.contentType("application/json")
            res.end(JSON.stringify({data: data, type: 0, ended: new_data.ended})); 
        
            clearInterval(i);
        }
        else if (old_data.ended != new_data.ended) {
            res.contentType("application/json")
            res.end(JSON.stringify({data: new_data.ended, type: 1})); 
            clearInterval(i);
        }
        old_data = new_data
    }, 250);

})

app.post("/post/thread", (req, res) => {
    console.log("/post/thread");
    var {title, name, text} = req.body;
    const id = generate_random_userid(req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown');
    const thrid = generate_random_threadid()

    if ( name == "" ) {
        name = "名無しさん"
    }

    if ( text != "" ) {
        var d = new Date();
        var thread_object = {
            title : title,
            banned: [],
            ended: false,
            contents: [
                {
                    name: escapeHtml(name),
                    text: escapeHtml(text),
                    date: d.toLocaleString(),
                    id: id
                }
            ],
            admin: id,
            id: thrid
        }
        
        fs.writeFileSync(`./BBS/${thrid}.json`, JSON.stringify(thread_object));
    }
    res.redirect(`/thread/${thrid}`)

});

app.post("/post/:id", (req, res) => {
    console.log("/post/:id");
    res.contentType("text/plain");
    var {name, text} = req.body;

    if ( name == "" ) {
        name = "名無しさん"
    }

    try {
        const id = generate_random_userid(req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown')
        var data = fs.readFileSync(`./BBS/${req.params.id}.json`);
        var thread = JSON.parse(data);
        if ( text != "" && !thread.ended && !thread.banned.includes(id) && thread.contents.length < 1000) {
            var d = new Date();

            text = escapeHtml(text);

            text, thread = parse(text, thread);

            thread.contents.push({
                name: escapeHtml(name),
                text: text,
                date: d.toLocaleString(),
                id: id
            });
            fs.writeFileSync(`./BBS/${thread.id}.json`, JSON.stringify(thread));
            res.end("OK");
        } else {
            res.end("ERR");
        }
    } catch ( err ) {
        res.end("INTERNAL-SERVER-ERROR " + err);
    }
});


app.get("/history", (req, res) => {
    console.log("/history");
    res.render("history", {})
});

app.get("/api/tgJSON/:id", (req, res) => {

    var new_data = JSON.parse(fs.readFileSync(`./BBS/${req.params.id}.json`));

    res.contentType("application/json")
    res.end(JSON.stringify(new_data)); 

});

app.post("/operation/ban", (req, res) => {
    const id = generate_random_userid(req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown')
    
    var thrid = req.body.thrid;
    var rsp_index = req.body.rsp_index;
    var thread = JSON.parse(fs.readFileSync(`./BBS/${thrid}.json`));

    if ( rsp_index-1 < thread.contents.length && rsp_index > 0 && thread.admin == id) {
        thread.banned.push(thread.contents[rsp_index-1].id);
    }
    fs.writeFileSync(`./BBS/${thrid}.json`, JSON.stringify(thread));
    res.contentType("application/json");
    res.end('"OK"'); 
});

app.post("/operation/Post-Thread-Delay", (req, res) => {
    var {PTD_title, PTD_name, PTD_text, thrid} = req.body;

    var from_thread = JSON.parse(fs.readFileSync(`./BBS/${thrid}.json`));

    console.log("/operation/Post-Thread-Delay");
    const id = generate_random_userid(req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown');
    new_thrid = generate_random_threadid()

    if ( PTD_name == "" ) {
        PTD_name = "名無しさん"
    }

    if ( PTD_text != "" ) {
        var d = new Date();
        var thread_object = {
            title : PTD_title,
            banned: from_thread.banned,
            ended: false,
            contents: [
                {
                    name: escapeHtml(PTD_name),
                    text: escapeHtml(PTD_text),
                    date: d.toLocaleString(),
                    id: id
                }
            ],
            admin: from_thread.admin,
            id: new_thrid
        }
        
        fs.writeFileSync(`./BBS/${new_thrid}.json`, JSON.stringify(thread_object));
    }
    res.redirect(`/thread/${new_thrid}`)

});

app.listen(8080, ()=>{
    console.log("サーバーを開始: 8080")
});

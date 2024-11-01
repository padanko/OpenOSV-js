const fs = require("fs");
const ninja_path = "./ninja.json"

function load_or_create() {
    if ( !fs.existsSync(ninja_path) ) {
        fs.createWriteStream(ninja_path).write("{}");
    } 
    return JSON.parse(fs.readFileSync(ninja_path));
}

function save(ninja) {
    fs.writeFileSync(ninja, JSON.stringify(ninja, null, 4))
}
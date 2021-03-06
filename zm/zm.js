#!/usr/bin/env node

const Session = require("zebrajs");
const utils = require("zebrajs/lib/utils");
const safeEval = require("zebrajs/lib/utils/safeeval");

const fs = require("fs");
const path = require("path");

var localPath;

function _readFile (filename) {
    if (filename.indexOf(".z") === -1) {
        filename += ".z";
    }

    console.log(filename);

    return new Promise(function (resolve, reject) {
        fs.readFile(filename, function (err, data) {
           if (err) {
               reject(err);
           }
           else {
               resolve(data.toString());
           }
        });
    });
}

function readFile (filename) {
    return _readFile(filename).then(function (r) {
        return r;
    }, function () {
        return _readFile(path.join(localPath, filename)).then(function (r) {
            return r;
        }, function () {
            console.log(path.join("zlib", filename));
            return _readFile(path.join("zlib", filename)).then(function (r) {
                return r;
            }, function () {
                return Promise.reject("Can't find z file: " + filename);
            });
        });
    });
}

function run (filename) {
    localPath = path.dirname(filename);
    
    console.log("LocalPath = " + localPath);
    
    const session = new Session({
        readFile
    });
    
    function toString (branchId) {
        const query = session.zvs.getObject(branchId, session.zvs.data.global("query"));
        return utils.toString(query, true);
    }
    
    const queryIds = [];
    
    session.events.on('query-start', function (queryBranchId) {
        if (queryIds.indexOf(queryBranchId) === -1) {
            queryIds.push(queryBranchId);
            // console.log("Query Started => " + toString(queryBranchId));
        }
    });
    
    session.events.on('success', function (branchId) {
        const queryBranchId = session.zvs.getObject(branchId, session.zvs.data.global("queryBranchId")).data;

        if (queryIds.indexOf(queryBranchId) !== -1) {
            // const functions = session.zvs.getObject(queryBranchId, session.zvs.data.global("queryFunctions")).data;

            const queryBranch = session.zvs.branches.getBranch(queryBranchId);
            const functions = queryBranch.func?[queryBranch.func]:[];

            if (functions.length > 0) {
                functions.forEach(function (f) {
                    try {
                        const c = safeEval(["query", "result"], f);
                        const {query, result} = c(
                            session.zvs.getObject(queryBranchId, session.zvs.data.global("query")),
                            session.zvs.getObject(branchId, session.zvs.data.global("query"))
                        );
                        
                        console.log(
                            " === Query ===\n" +
                            (query?query:toString(queryBranchId)) 
                            + "\n\n--- Solution ---\n" + 
                            (result?result:toString(branchId))
                        );
                    }
                    catch (e) {
                        console.log("Error function : " + f + ", Exception: " + e);
                    }
                });
            }
            else {
                console.log("Query Success: " + toString(queryBranchId) + " => " + toString(branchId));
            }
        }
    });
    
    session.events.on('track', function ({id: queryBranchId, actives}) {
        const index = queryIds.indexOf(queryBranchId);
        if (actives === 0 && index !== -1) {
            // query ended remove it from list,
            queryIds.splice(index, 1);
            // console.log("Query Ended => " + toString(queryBranchId));
        }
    });
    
    session.add({value: "[" + filename + "]"});
}

if (process.argv.length === 3) {
    run(process.argv[2]);
}
else {
    console.log(process.argv[1] + " <filename>");
}


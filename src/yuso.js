/*
varsion: 0.0.2-u.1
*/

class Yuso {
    constructor() {
        this.routes = {};
        this.notFound = "/404.html";
    }

    async fileGet(fetchUrl) {
        const timeout = new AbortController();
        const timeoutTimer = window.setTimeout(() => {
            timeout.abort();
        }, 6000);

        return await fetch(fetchUrl, {
            signal: timeout.signal
        }).then( async (res) => {
            clearTimeout(timeoutTimer);

            if ( res.ok ) {
                return {
                    ok : true,
                    code : res.status,
                    body : await res
                }
            } else {
                return {
                    ok : false,
                    code : res.status,
                    body : null
                }
            }
        } ).catch( (err) => {
            clearTimeout(timeoutTimer);

            return {
                ok : false,
                code : 0,
                body : null
            }
        } );
    }

    async load(loadFiles) {
        const keys = Object.keys(loadFiles);

        if ( keys.includes("html") ) {
            const idPaths = loadFiles.html;
            const ids = Object.keys(idPaths);

            for ( let i = 0; i < ids.length; i++ ) {
                const id = ids[i];
                const path = idPaths[id];

                const res = await this.fileGet(path);

                if ( res.ok ) {
                    addEventListener("DOMContentLoaded", async () => {
                        document.getElementById(id).innerHTML = (await res.body.text());
                    });
                } else {
                    location.replace(this.notFound);
                }
            }
        }

        if ( keys.includes("css") ) {
            const paths = loadFiles.css;

            for ( let i = 0; i < paths.length; i++ ) {
                const path = paths[i];

                // create link element
                let el = document.createElement("link");
                el.rel = "stylesheet";
                el.href = path;
                addEventListener("DOMContentLoaded", async () => {
                    document.body.appendChild(el);
                });
            }
        }

        if ( keys.includes("js") ) {
            const paths = loadFiles.js;
            
            for ( let i = 0; i < paths.length; i++ ) {
                const path = paths[i];

                // create link element
                let el = document.createElement("script");
                el.src = path;
                addEventListener("DOMContentLoaded", async () => {
                    document.body.appendChild(el);
                });
            }
        }
        /* DOMContentLoadedのイベントを複数設置するのはあまりよくないので、配列に関数を入れてしまうとか、(引数を分けて)したほうがよさそう。 */       
    }

    route(setPath, setFunction) {
        // 引数の確認(String, function)をここに入れる

        if ( !setPath.match(/^\//) ) {
            throw new Error("Route set error. route is / start");
        }

        let tokens = this._tokenize(setPath);

        //console.log(JSON.stringify(tokens,null,2));

        
        let sem_index = 0;
        function sem(route_obj) {
            const token = tokens[sem_index];
            const isLastToken = sem_index === (tokens.length - 1);

            if ( isLastToken ) {
                if ( token.type === "transit" ) {
                    route_obj.transit = setFunction;
                } else if ( token.type === "constant" ) {
                    route_obj[token.body] = {};
                    route_obj[token.body].this = setFunction;
                } else if ( token.type === "any" ) {
                    route_obj.any = {};
                    route_obj.any.this = setFunction;
                }
            } else if ( token.type === "any" ) {
                route_obj.any = {};
                sem_index += 1;
                sem(route_obj.any);
            } else if ( token.type === "constant" ) {
                route_obj[token.body] = {};
                sem_index += 1;
                sem(route_obj[token.body]);
            } else {
                throw new Error("不正な入力形式です。");
            }

            return route_obj;
        }
        this.routes = this._joinObject(this.routes, sem({}));

        console.log(JSON.stringify(this.routes, null, 2));
    }

    async run() {
        const reqPath = location.pathname;
        const reqRoute = reqPath.match(/\/[^\/]*/g);
        console.log(reqRoute);
        
        let mining_index = 0;
        let collback_obj = {
            params : []
        }
        
        async function mining(r, notFound) {
            const path = reqRoute[mining_index];
            const isLastPath = mining_index === (reqRoute.length - 1);

            if ( r.transit !== undefined ) {
                await r.transit(collback_obj);
            }

            console.log(r[path]);
            console.log(path);

            if ( isLastPath ) {
                if ( r[`${path}`] !== undefined && r[`${path}`].this !== undefined ) {
                    r[`${path}`].this(collback_obj);
                } else if ( r.any !== undefined && r.any.this !== undefined ) {
                    collback_obj.params.push(path.replace(/^\//, ""));
                    r.any.this(collback_obj);
                } else {
                    location.replace(notFound);
                }
            } else if ( r[`${path}`] !== undefined ) {
                mining_index += 1;
                mining(r[`${path}`]);
            } else if ( r.any !== undefined ) {
                collback_obj.params.push(path.replace(/^\//, ""));
                mining_index += 1;
                mining(r.any);
            } else {
                location.replace(notFound);
            }
        }

        // not found page check
        if ( location.pathname === this.notFound ) {
            return null;
        }

        await mining(this.routes, this.notFound);
    }

    _joinObject(baseObj, rideObj) {
        let resultObj = {};

        function dig(baseObjDig, rideObjDig) {
            const baseObjDigKeys = Object.keys(baseObjDig);
            const rideObjDigKeys = Object.keys(rideObjDig);

            for ( let i = 0; i < rideObjDigKeys.length; i++ ) {
                const key = rideObjDigKeys[i];

                if ( baseObjDigKeys.includes(key) ) {
                    if ( baseObjDig[key] instanceof Object && !Array.isArray(baseObjDig[key]) ) {
                        // dig object.
                        baseObjDig = Object.assign(baseObjDig, dig(baseObjDig[key], rideObjDig[key]));
                    } else {
                        // content update.
                        baseObjDig[key] = rideObjDig[key];
                    }
                } else {
                    // content create.
                    baseObjDig[key] = rideObjDig[key];
                }
            }

            resultObj = baseObjDig;
        }
        dig(baseObj, rideObj);

        return resultObj;
    }

    _tokenize(inputPath) {
        let tokens = [];
        function tokenize(inPath) {
            if ( inPath.match(/^\/\+/) ) {
                tokens.push({
                    type : "transit",
                    body : "/+"
                });
                inPath = inPath.replace(/^\/\+/, "");
            } else if ( inPath.match(/^\/\*/) ) {
                tokens.push({
                    type : "any",
                    body : "/*"
                });
                inPath = inPath.replace(/^\/\*/, "");
            } else {
                const constantMatch = inPath.match(/^\/[^\/]*/);
                if ( constantMatch ) {
                    tokens.push({
                        type : "constant",
                        body : constantMatch[0]
                    });
                    inPath = inPath.replace(/^\/[^\/]*/, "");
                }
            }
    
            if ( inPath.length <= 0 ) {
                return null;
            } else {
                return tokenize(inPath);
            }
        }
        tokenize(inputPath);

        return tokens;
    }
}
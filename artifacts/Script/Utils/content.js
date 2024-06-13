let connectionPools = {};

async function RequestHandler(path, systemid, format, opts) {
    // Get system information
    const manager = p9.manager ? p9.manager : modules.typeorm.getConnection().manager;
    const system = await manager.findOne("systems", {
        select: ["url", "id"],
        where: { id: systemid },
    });

    if (!system) return { error: "Remote System not registered in system" };

    // Get local proxy auth - Role
    let auth = await entities.neptune_af_connector_auth.findOne({ role: p9.system.role });

    // Get local proxy auth - Default
    if (!auth) auth = await entities.neptune_af_connector_auth.findOne({ role: "DEFAULT" });

    // Any Auth ?
    if (!auth) return { error: "Local API Proxy Auth not registered in settings" };

    let data = auth.username + ":" + auth.password;
    let buff = new Buffer(data);
    let basic = buff.toString("base64");

    // URL
    const url =
        "http://127.0.0.1:8080/proxy/remote/" +
        encodeURIComponent(system.url + path) +
        "/" +
        system.id;

    let options = {
        method: "GET",
        headers: {
            Authorization: "Basic " + basic,
        },
    };

    if (opts && opts.body) options.body = opts.body;
    if (opts && opts.method) options.method = opts.method;
    if (opts && opts.headers) options.headers = { ...options.headers, ...opts.headers };

    if (format === "xml") options.headers["content-type"] = "application/xml";
    if (format === "json") options.headers["content-type"] = "application/json";

    const response = await fetch(url, options);

    const contentType = response.headers.get("content-type");

    let responseData = {
        headers: response.headers,
        data: null,
    };

    if (response.status !== 200) {
        responseData.message = response.status + ": " + response.statusText;
    }

    if (response.status === 401) {
        return responseData;
    }

    if (contentType.indexOf("text/") > -1) {
        responseData.data = await response.text();
        responseData.message += " - " + responseData.data;
    } else if (format === "xml") {
        responseData.data = await response.text();
    } else {
        responseData.data = await response.json();
    }

    return responseData;
}

async function HANAConnect(dbid) {
    return new Promise(async function (resolve, reject) {
        const HDB = modules.hdb;

        // Check if HDB is installed
        if (!HDB)
            return resolve({ error: "Missing NPM module HDB. Please install from NPM Modules" });

        // Get database connection - Role
        let dburi = await entities.neptune_af_connector_dburi.findOne({
            dbid: dbid,
            role: p9.system.role,
        });

        // Get database connection - Default
        if (!dburi)
            dburi = await entities.neptune_af_connector_dburi.findOne({
                dbid: dbid,
                role: "DEFAULT",
            });

        // Any DB ?
        if (!dburi)
            return resolve({ error: "Database connection string not registered in settings" });

        // Create Client
        const client = HDB.createClient({
            host: dburi.host,
            port: dburi.port,
            user: dburi.username,
            password: dburi.password,
        });

        client.on("error", function (err) {
            resolve({ error: err });
        });

        client.connect(function (err) {
            if (err) {
                resolve({ error: "HANA DB Client is not connected" });
            } else {
                resolve(client);
            }
        });
    });
}

async function HANAExec(client, statement) {
    return new Promise(async function (resolve, reject) {
        try {
            if (!client.exec) return resolve({ error: "HANA DB Client is not connected" });

            client.exec(statement, function (err, res) {
                if (err) {
                    resolve(err);
                } else {
                    resolve(res);
                }
            });
        } catch (err) {
            resolve({ error: "HANA DB Client is not connected" });
        }
    });
}

async function MSSQLExec(dbid, query) {
    return new Promise(async function (resolve, reject) {
        const SQL = modules.mssql;

        // Check if SQL is installed
        if (!SQL) {
            return resolve({ error: "Missing NPM module MSSQL. Please install from NPM Modules" });
        }

        // Get database connection - Role
        let dburi = await entities.neptune_af_connector_dburi.findOne({
            dbid: dbid,
            role: p9.system.role,
        });

        // Get database connection - Default
        if (!dburi) {
            dburi = await entities.neptune_af_connector_dburi.findOne({
                dbid: dbid,
                role: "DEFAULT",
            });
        }

        // Any DB ?
        if (!dburi)
            return resolve({ error: "Database connection string not registered in settings" });

        try {
            let options;

            // Connection String
            if (dburi.connectionstring) {
                options = dburi.connectionstring;
            } else {
                options = {
                    user: dburi.username,
                    password: dburi.password,
                    database: dburi.database,
                    server: dburi.host,
                    port: dburi.port,
                    options: {
                        trustServerCertificate: true,
                    },
                };
            }

            // Connect to DB
            if (!connectionPools[dburi.database]) {
                const pool = new SQL.ConnectionPool(options);
                connectionPools[dburi.database] = await pool.connect();
            }

            const result = await connectionPools[dburi.database].query(query);

            resolve(result);
        } catch (e) {
            if (e?.originalError?.info?.message) {
                resolve({ error: e.originalError.info.message, mssqlError: e });
            } else if (e?.code) {
                let errorMessage = "";

                switch (e.code) {
                    case "ELOGIN":
                        errorMessage = "Login failed. Please check username/password and database";
                        break;

                    default:
                        errorMessage = e.code;
                        break;
                }

                resolve({ error: errorMessage, mssqlError: e });
            } else {
                resolve({ error: "MS SQL Server is not connected", mssqlError: e });
            }
        }
    });
}

function SortBy(property) {
    return function (a, b) {
        if (a[property] > b[property]) return 1;
        else if (a[property] < b[property]) return -1;
        return 0;
    };
}

complete({
    RequestHandler,
    HANAConnect,
    HANAExec,
    MSSQLExec,
    SortBy,
});

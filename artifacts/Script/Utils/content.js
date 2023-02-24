async function RequestHandler(path, systemid, format, opts) {

    // Get system information
    const manager = modules.typeorm.getConnection().manager;
    const system = await manager.findOne('systems', { select: ["url", "id"], where: { id: systemid } });

    if (!system) return { error: "Remote System not registered in system" };

    // Get local proxy auth
    const auth = await entities.neptune_af_connector_auth.findOne({ role: p9.system.role });

    if (!auth) return { error: "Local API Proxy Auth not registered in settings" };

    let data = auth.username + ":" + auth.password;
    let buff = new Buffer(data);
    let basic = buff.toString('base64');

    // URL
    const url = "http://127.0.0.1:8080/proxy/remote/" + encodeURIComponent(system.url + path) + "/" + system.id;

    let options = {
        method: 'GET',
        headers: {
            Authorization: "Basic " + basic
        }
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
        data: null
    }

    if (response.status !== 200) {
        responseData.message = response.status + ": " + response.statusText;
    }

    if (response.status === 401) {
        return responseData;
    }

    if (contentType.indexOf("text/plain") > -1) {
        responseData.data = await response.text();
        responseData.message += " - " + responseData.data;
    } else if (format === "xml") {
        responseData.data = await response.text();
    } else {
        responseData.data = await response.json();
    }

    return responseData;

}

function SortBy(property) {
    return function (a, b) {
        if (a[property] > b[property])
            return 1;
        else if (a[property] < b[property])
            return -1;
        return 0;
    }
}

complete({
    RequestHandler,
    SortBy
})
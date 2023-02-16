async function RequestHandler(path, systemid, format, opts) {

    const request = modules.request;

    // Get system information
    const manager = modules.typeorm.getConnection().manager;
    const system = await manager.findOne('systems', { select: ["url", "id"], where: { id: systemid } });

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

    if (opts && opts.headers) options.headers = { ...options.headers, ...opts.headers };

    const response = await fetch(url, options);

    return {
        data: await response.json(),
        headers: response.headers
    }

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
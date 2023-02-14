async function RequestHandler(path, systemid, format, opts) {

    const request = modules.request;
    const manager = modules.typeorm.getConnection().manager;

    const system = await manager.findOne('systems', { where: { id: systemid } });

    return new Promise((resolve, reject) => {

        let options = {
            method: 'GET',
            url: "http://127.0.0.1:8080/proxy/remote/" + encodeURIComponent(system.url + path) + "/" + system.id,
            headers: {
                Authorization: "Basic YWRtaW46VXhwMjAxOSE=" // TODO - From Settings
            }
        };

        if (opts && opts.headers) options.headers = { ...options.headers, ...opts.headers };

        request(options, async function (error, response, body) {
            if (error) return reject(error);

            let data = body;

            if (format === "json") {
                try {
                    data = JSON.parse(data);
                } catch (e) { }
            }

            resolve({
                data,
                response
            });

        });

    });

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
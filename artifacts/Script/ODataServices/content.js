const opts = {
    parameters: {
        "$format": "json"
    }
}

let services = [];

try {

    const res = await apis.services(opts);

    for (i = 0; i < res.data.d.results.length; i++) {

        const service = res.data.d.results[i];

        services.push({
            title: service.Title,
            description: service.Description,
            author: service.Author,
        })

    }

    result.data = services;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

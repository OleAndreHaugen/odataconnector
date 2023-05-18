const SystemId = req.query.systemid;
const SystemUrl = "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json";

let services = [];

// Check for system ID
if (!SystemId) {
    result.data = { error: "Please select system" };
    return complete();
}

try {
    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

    if (res.error) {
        result.data = res;
        return complete();
    }

    if (res.message) {
        result.data = { error: res.message };
        return complete();
    }

    for (let i = 0; i < res.data.d.results.length; i++) {
        const service = res.data.d.results[i];

        services.push({
            title: service.Title,
            description: service.Description,
            author: service.Author,
        });
    }

    result.data = services;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

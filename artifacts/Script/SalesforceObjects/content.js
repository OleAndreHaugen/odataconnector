const SystemId = req.query.systemid;
const SystemUrl = "/services/data/v56.0/sobjects";

let sobjects = [];

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

    for (let i = 0; i < res.data.sobjects.length; i++) {
        const sobject = res.data.sobjects[i];

        sobjects.push({
            name: sobject.name,
            label: sobject.label,
            createable: sobject.createable,
            deletable: sobject.deletable,
            updateable: sobject.updateable,
        });
    }

    result.data = sobjects;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

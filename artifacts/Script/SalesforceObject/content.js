const SystemId = req.query.systemid;
const SystemUrl = "/services/data/v56.0/sobjects/" + req.query.table + "/describe";

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

    result.data = res.data;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

const data = await entities.neptune_af_connector.delete(req.query.id);
result.data = {
    status: "OK",
    message: "Connector Deleted"
};
complete();
const data = await entities.neptune_af_connector.findOne(req.query.id);
result.data = data;
complete();
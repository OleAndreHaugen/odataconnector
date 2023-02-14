const data = await entities.neptune_af_connector.findOne({ id: req.query.id });
result.data = data;
complete();
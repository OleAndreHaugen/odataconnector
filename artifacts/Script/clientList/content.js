const data = await entities.neptune_af_connector.find({
    select: ["name", "description", "updatedAt", "updatedBy"],
    order: {
        name: "ASC"
    }
});

result.data = data;
complete();
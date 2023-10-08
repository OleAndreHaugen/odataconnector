const manager = p9.manager ? p9.manager : modules.typeorm.getConnection().manager;

const systems = await manager.find("systems", {
    select: ["id", "name", "description"],
    order: { name: "ASC" },
});

const connectors = await entities.neptune_af_connector.find({
    where: { type: req.query.type },
    select: ["id", "name", "description", "updatedAt", "updatedBy", "systemid"],
    order: { name: "ASC" },
});

const db = await entities.neptune_af_connector_db.find({
    select: ["id", "name", "description"],
    order: { name: "ASC" },
});

result.data = {
    connectors,
    systems,
    db,
};

complete();

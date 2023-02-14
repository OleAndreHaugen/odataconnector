const manager = modules.typeorm.getConnection().manager;

const systems = await manager.find('systems', {
    select: ["id", "name", "description"],
    order: { name: "ASC" }
});

const connectors = await entities.neptune_af_connector.find({
    select: ["id", "name", "description", "updatedAt", "updatedBy", "systemid"],
    order: { name: "ASC" }
});

result.data = {
    connectors,
    systems
}

complete();
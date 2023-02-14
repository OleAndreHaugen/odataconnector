apiGetEntitySets({
    parameters: {
        service: modeloPageDetail.oData.config.service,
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    modeltabEntitySets.setData(res);
    diaEntitySets.setTitle("OData Entity Sets (" + res.length + ")");
});

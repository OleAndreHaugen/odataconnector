apiGetEntitySets({
    parameters: {
        service: modeloPageDetail.oData.config.service,
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabEntitySets.setData(res);
        diaEntitySets.setTitle("OData Entity Sets (" + res.length + ")");
    }
});

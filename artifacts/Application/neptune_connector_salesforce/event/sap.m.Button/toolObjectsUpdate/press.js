apiGetObjects({
    parameters: {
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabObjects.setData(res);
        diaObjects.setTitle("Salesforce Tables (" + res.length + ")");
    }
});

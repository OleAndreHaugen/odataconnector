apiGetServices({
    parameters: {
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabServices.setData(res);
        diaServices.setTitle("OData Services (" + res.length + ")");
    }
});

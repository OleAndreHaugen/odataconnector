const controller = {
    filter: "",
    type: "servicenow",
    init: function () {
        jQuery.sap.require("sap.m.MessageBox");

        if (!cockpitUtils.isCockpit) {
            sap.m.MessageBox.confirm("Neptune ServiceNow Connectors is only supported to run inside our Cockpit. Press OK and we will guide to to the right place.", {
                icon: sap.m.MessageBox.Icon.INFORMATION,
                title: "System Information",
                actions: [sap.m.MessageBox.Action.OK],
                initialFocus: "Ok",
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        location.href = location.origin + "/cockpit.html#afconnector-servicenow";
                    }
                },
            });
        }
    },

    new: function () {
        modeloPageDetail.setData({
            name: "",
            description: "",
            metadata: {},
            config: {},
            type: controller.type,
        });

        tabDetail.setSelectedItem(tabDetailInfo);
        cockpitUtils.toggleCreate();
        cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        oApp.to(oPageDetail);
    },

    delete: function () {
        sap.n.Planet9.objectDelete(function () {
            oApp.setBusy(true);
            sap.n.Planet9.setToolbarButton(false);

            apiDelete({
                parameters: {
                    id: modeloPageDetail.oData.id,
                },
            }).then(function (res) {
                sap.m.MessageToast.show("Connector Deleted");
                controller.list();
                oApp.setBusy(false);
                oApp.back();
            });
        }, "ServiceNow Connector");
    },

    save: function () {
        // Check Required Fields
        if (!sap.n.Planet9.requiredFieldsCheck(cockpitUtils.requiredFields)) {
            return;
        }

        apiSave({
            data: modeloPageDetail.oData,
        }).then(function (req) {
            if (req.message) {
                sap.m.MessageToast.show(req.message);
            }

            sap.m.MessageToast.show("Connector Saved");
            modeloPageDetail.oData.id = req.id;
            modeloPageDetail.oData.updatedAt = req.updatedAt;
            modeloPageDetail.oData.updatedBy = req.updatedBy;
            modeloPageDetail.oData.createdAt = req.createdAt || req.updatedAt;
            modeloPageDetail.oData.createdBy = req.createdBy;
            modeloPageDetail.refresh();
            controller.list();

            cockpitUtils.dataSaved = modeloPageDetail.getJSON();
            cockpitUtils.toggleEdit(true);
        });
    },

    get: function (id, editable) {
        apiGet({
            parameters: {
                id: id,
            },
        }).then(function (req) {
            modeloPageDetail.setData(req);

            if (oApp.getCurrentPage() === oPageStart) {
                tabDetail.setSelectedItem(tabDetailInfo);
            }

            toolFieldsFilter.setValue();
            toolFieldsFilter.fireLiveChange();

            oApp.to(oPageDetail);

            cockpitUtils.toggleEdit(editable);
            cockpitUtils.dataSaved = modeloPageDetail.getJSON();

            controller.filter = "";
            controller.setFieldFilter();
        });
    },

    list: function () {
        apiList({
            parameters: {
                type: controller.type,
            },
        }).then(function (res) {
            modelappData.setData(res);
        });
    },

    openServices: function () {
        if (!modeltabObjects.oData || !modeltabObjects.oData.length) toolObjectsUpdate.firePress();
        toolObjectsFilter.setValue();
        toolObjectsFilter.fireLiveChange();
        tabObjects.clearSelection();

        diaObjects.open();
    },

    openEntitySet: function () {
        toolEntitySetsUpdate.firePress();
        toolEntitySetsFilter.setValue();
        toolEntitySetsFilter.fireLiveChange();
        tabEntitySets.clearSelection();

        diaEntitySets.open();
    },

    setFieldFilter: function () {
        toolFieldsNavigation.destroyLinks();

        toolFieldsNavigation.addLink(
            new sap.m.Link({
                text: modeloPageDetail.oData.config.table,
                press: function (oEvent) {
                    controller.filter = "";
                    controller.setFieldFilter();
                },
            })
        );

        const parts = controller.filter.split(".");
        let parent = "";
        let sep = "";

        parts.forEach(function (part) {
            if (part) {
                const link = new sap.m.Link({
                    text: part,
                    press: function (oEvent) {
                        const links = toolFieldsNavigation.getLinks();

                        for (let i = 1; i < links.length; i++) {
                            const link = links[i];
                            parent += sep + link.getText();
                            sep = ".";
                            if (link.sId === this.sId) break;
                        }

                        controller.filter = parent;
                        controller.setFieldFilter();
                    },
                });
                toolFieldsNavigation.addLink(link);
            }
        });

        toolFieldsFilter.setValue();
        toolFieldsFilter.fireLiveChange();
        
    },

    getFields: function (tableName, parentField) {
        tabFields.setBusy(true);

        return new Promise(function (resolve) {
            apiGetTable({
                parameters: {
                    table: tableName,
                    systemid: modeloPageDetail.oData.systemid,
                },
            }).then(function (metadata) {
                resolve(controller.buildFields(metadata, tableName, parentField));
            });
        });
    },

    buildFields: function (metadata, tableName, parentField) {
        let selected = [];
        let fields = [];
        let _parent = "";

        if (!modeloPageDetail.oData.config.fields) modeloPageDetail.oData.config.fields = [];

        // Get Selected Fields
        if (modeloPageDetail.oData && modeloPageDetail.oData.config && modeloPageDetail.oData.config.fields) {
            selected = ModelData.Find(modeloPageDetail.oData.config.fields, "sel", true);
        }

        // Parent
        if (parentField) {
            if (parentField._parent) {
                const fieldParts = parentField.name.split(".");
                const fieldName = fieldParts[fieldParts.length - 1];

                _parent = parentField._parent + "." + fieldName;
            } else {
                _parent = parentField.name;
            }
        }

        // Apply Filter
        controller.filter = _parent;

        // Fields
        metadata.forEach(function (field) {
            if (!field._parent) field.name = _parent ? _parent + "." + field.name : field.name;
            field._parent = _parent;

            // Selected
            const selectedField = ModelData.FindFirst(selected, "name", field.name);
            if (selectedField) field.sel = true;

            fields.push(field);
        });

        // Delete Fields with this parent
        ModelData.Delete(modeloPageDetail.oData.config.fields, "_parent", controller.filter);
        ModelData.AddArray(modeloPageDetail.oData.config.fields, fields);

        controller.setFieldFilter();

        modeloPageDetail.refresh();

        tabFields.setBusy(false);
    },

    updateFields: async function () {
        controller.filter = "";
        controller.setFieldFilter();
        controller.getFields(modeloPageDetail.oData.config.table);
    },

    updateItems: async function () {
        let selected = [];

        if (modeldiaItems.oData && modeldiaItems.oData.items) {
            selected = ModelData.Find(modeldiaItems.oData.items, "sel", true);
        }

        tabItems.setBusy(true);

        apiGetItems({
            parameters: {
                table: modeldiaItems.oData.reference_table,
                systemid: modeloPageDetail.oData.systemid,
                displayfield: modeldiaItems.oData.display_field,
            },
        }).then(function (res) {
            if (res.error) {
                sap.m.MessageToast.show(res.error);
            } else {
                let items = [];

                for (let i = 0; i < res.length; i++) {
                    const field = res[i];
                    let item = {
                        sel: false,
                        value: field["sys_id"],
                        label: field[modeldiaItems.oData.display_field],
                    };
                    const fieldSelected = ModelData.FindFirst(selected, "value", field["sys_id"]);
                    if (fieldSelected) item.sel = true;

                    items.push(item);
                }
                modeldiaItems.oData.items = items;
                modeldiaItems.refresh(true);
            }

            tabItems.setBusy(false);
        });
    },
};

controller.init();

const controller = {
    filter: "",
    type: "salesforce",
    init: function () {
        jQuery.sap.require("sap.m.MessageBox");

        if (!cockpitUtils.isCockpit) {
            sap.m.MessageBox.confirm("Neptune Salesforce Connectors is only supported to run inside our Cockpit. Press OK and we will guide to to the right place.", {
                icon: sap.m.MessageBox.Icon.INFORMATION,
                title: "System Information",
                actions: [sap.m.MessageBox.Action.OK],
                initialFocus: "Ok",
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        location.href = location.origin + "/cockpit.html#afconnector-salesforce";
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
        }, "Salesforce Connector");
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
        toolObjectsUpdate.firePress();
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

    updateFields: async function () {
        controller.filter = "";
        controller.setFieldFilter();
        controller.getFields(modeloPageDetail.oData.config.table);
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
        return new Promise(function (resolve) {
            const cache = ModelData.FindFirst(Metadata, "table", tableName);

            if (cache) {
                resolve(controller.buildFields(cache.metadata, tableName, parentField));
            } else {
                apiGetObject({
                    parameters: {
                        table: tableName,
                        systemid: modeloPageDetail.oData.systemid,
                    },
                }).then(function (metadata) {
                    ModelData.Add(Metadata, { table: tableName, metadata: metadata });
                    resolve(controller.buildFields(metadata, tableName, parentField));
                });
            }
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
            if (parentField.relationshipName) {
                if (parentField._parent) {
                    _parent = parentField._parent + "." + parentField.relationshipName;
                } else {
                    _parent = parentField.relationshipName;
                }
            } else {
                _parent = parentField._parent;
            }
        }

        // Apply Filter
        controller.filter = _parent;

        // Fields
        metadata.fields.forEach(function (field) {
            let rec = {
                _parent: _parent,
                sel: false,
                name: _parent ? _parent + "." + field.name : field.name,
                label: field.label,
                type: field.type,
                referenceTo: field.referenceTo,
                relationshipName: field.relationshipName,
                fieldName: field.name,
                tableName: tableName,
                updateable: field.updateable,
                filterable: field.filterable,
                picklistValues: field.picklistValues,
            };

            // Selected
            const selectedField = ModelData.FindFirst(selected, "name", rec.name);
            if (selectedField) rec.sel = true;

            fields.push(rec);
        });

        // Sorting
        // fields = fields.sort(sort_by("label", false));

        // Delete Fields with this parent
        ModelData.Delete(modeloPageDetail.oData.config.fields, "_parent", controller.filter);
        ModelData.AddArray(modeloPageDetail.oData.config.fields, fields);

        controller.setFieldFilter();

        modeloPageDetail.refresh();
    },
};

controller.init();

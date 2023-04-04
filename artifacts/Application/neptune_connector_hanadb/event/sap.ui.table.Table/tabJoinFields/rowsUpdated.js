let binding = tabJoinFields.getBinding("rows");
if (!binding) return;

diaJoinFields.setTitle(controller.fieldOpenData.joinTable + ": Fields (" + binding.getLength() + ")");
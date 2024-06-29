let binding = tabData.getBinding("rows");
if (!binding) return;

oPageHeaderNumber.setNumber("(" + binding.getLength() + ")");

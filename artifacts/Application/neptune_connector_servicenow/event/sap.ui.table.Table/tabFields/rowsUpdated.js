let binding = tabFields.getBinding("rows");
if (!binding) return;

tabDetailFields.setCount(binding.getLength());

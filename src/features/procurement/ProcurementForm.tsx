import { Truck, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadZone } from "@/components/shared/ImageUploadZone";

interface ProcurementFormProps {
  formData: { name: string; quantity: string; unit: string };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; quantity: string; unit: string }>>;
  imageUrl: string;
  onImageAdded: (dataUrl: string) => void;
  onClearImage: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProcurementForm({
  formData,
  setFormData,
  imageUrl,
  onImageAdded,
  onClearImage,
  onSubmit,
}: ProcurementFormProps) {
  return (
    <Card className="border-border/50 shadow-md rounded-2xl sticky top-28">
      <CardHeader className="bg-primary/5 border-b border-primary/10 rounded-t-2xl pb-4">
        <CardTitle className="flex items-center gap-2 text-primary">
          <Truck className="w-5 h-5" />
          New Order Request
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-semibold">Item Name</Label>
            <Input
              id="name"
              placeholder="e.g. Organic Tomatoes"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="font-semibold">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                className="rounded-xl h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit" className="font-semibold">Unit</Label>
              <Select value={formData.unit} onValueChange={(val) => setFormData((prev) => ({ ...prev, unit: val }))}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="gm">Grams (gm)</SelectItem>
                  <SelectItem value="litre">Litres (L)</SelectItem>
                  <SelectItem value="pcs">Pieces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Image (Optional)</Label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border/50 bg-muted aspect-video">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={onClearImage}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <ImageUploadZone
                multiple={false}
                onFilesAdded={(urls) => { if (urls[0]) onImageAdded(urls[0]); }}
                className="py-6"
              />
            )}
          </div>

          <Button type="submit" className="w-full rounded-xl h-12 mt-2 shadow-lg shadow-primary/20 text-md font-semibold hover-elevate">
            <Plus className="w-5 h-5 mr-2" />
            Place Order
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

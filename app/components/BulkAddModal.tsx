"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  Layers,
  ChevronDown,
  MapPin,
  Type,
  Smartphone,
  PlusCircle,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BRANDS,
  SLOGANS,
  TOWNS,
  DEFAULT_DESCRIPTION
} from "@/lib/manual-data";
import type { ListingDraft } from "@/lib/types";

interface BulkAddModalProps {
  onAdd: (drafts: { draft: ListingDraft; preview: string | null }[]) => void;
  onClose: () => void;
}

export function BulkAddModal({ onAdd, onClose }: BulkAddModalProps) {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0].name);
  const [selectedModel, setSelectedModel] = useState(BRANDS[0].models[0]);
  const [selectedSlogan, setSelectedSlogan] = useState(SLOGANS[0]);
  const [selectedTown, setSelectedTown] = useState(TOWNS[0]);

  const handleBrandChange = (brandName: string) => {
    setSelectedBrand(brandName);
    const brand = BRANDS.find((b) => b.name === brandName);
    if (brand && brand.models.length > 0) {
      setSelectedModel(brand.models[0]);
    }
  };

  const handleBulkAdd = () => {
    const newDrafts: { draft: ListingDraft; preview: string | null }[] = [];

    for (let i = 0; i < 10; i++) {
      // Use sequential slogans and towns
      const currentSlogan = SLOGANS[i % SLOGANS.length];
      const currentTown = TOWNS[i % TOWNS.length];

      // Random price between 52,000 and 54,000 for variety
      const rawPrice = 52000 + Math.floor(Math.random() * 2001);
      const price = Math.round(rawPrice / 10) * 10;
      
      const listingName = `${currentSlogan} ${selectedModel} 256 GB`.toUpperCase();

      const draft: ListingDraft = {
        _id: `bulk_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        name: listingName,
        slug: listingName.toLowerCase().replace(/\s+/g, "-"),
        brand: selectedBrand,
        model: selectedModel,
        series: selectedModel,
        product: selectedModel,
        productType: "Akıllı Telefon",
        vehicleType: selectedBrand,
        condition: "Sıfır",
        category: "Cep Telefonu",
        partCategory: selectedModel,
        price,
        description: DEFAULT_DESCRIPTION,
        storage: "256 GB",
        town: currentTown,
        imageUrl: "", 
        imagePath: "", 
        inStock: true,
        createdAt: new Date().toISOString(),
        categoryPath: ["İkinci El ve Sıfır Alışveriş", "Cep Telefonu", "Modeller", selectedBrand, selectedModel],
        confidence: 1.0,
        fieldConfidence: {
          brand: 1.0,
          model: 1.0,
          vehicleType: 1.0,
          partCategory: 1.0,
          product: 1.0,
        },
        sourceHints: ["Toplu Ekleme"],
        warnings: [],
      };

      newDrafts.push({ draft, preview: null });
    }

    onAdd(newDrafts);
    onClose();
  };

  const selectBase = "w-full rounded-xl border border-zinc-800 bg-[#0d1117] px-4 py-3.5 text-sm text-zinc-200 outline-none appearance-none focus:border-[#11F08E]/50 focus:ring-1 focus:ring-[#11F08E]/20 transition-all cursor-pointer";

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#11F08E]/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-[#11F08E]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Toplu İlan Ekle</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Tek tıkla 10 adet taslak oluştur</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Type className="w-3.5 h-3.5" /> Başlık Sloganı
            </label>
            <div className="relative">
              <select
                value={selectedSlogan}
                onChange={(e) => setSelectedSlogan(e.target.value)}
                className={selectBase}
              >
                {SLOGANS.map(s => (
                  <option key={s} value={s} className="bg-zinc-900">{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> İlçe
            </label>
            <div className="relative">
              <select
                value={selectedTown}
                onChange={(e) => setSelectedTown(e.target.value)}
                className={selectBase}
              >
                {TOWNS.map(t => (
                  <option key={t} value={t} className="bg-zinc-900">{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" /> Marka
            </label>
            <div className="relative">
              <select
                value={selectedBrand}
                onChange={(e) => handleBrandChange(e.target.value)}
                className={selectBase}
              >
                {BRANDS.map(b => (
                  <option key={b.name} value={b.name} className="bg-zinc-900">{b.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" /> Model
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={selectBase}
              >
                {BRANDS.find(b => b.name === selectedBrand)?.models.map(m => (
                  <option key={m} value={m} className="bg-zinc-900">{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Önizleme & Bilgi</h4>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              Oluşturulacak Başlık: <span className="text-[#11F08E] font-bold">{selectedSlogan} {selectedModel} 256 GB</span>
            </p>
            <p className="text-[10px] text-zinc-500 leading-relaxed italic">
              Bu işlem ile kuyruğa 10 adet taslak eklenecektir. Her ilanın fiyatı 52.000 TL - 54.000 TL arasında rastgele belirlenecektir. Görselleri daha sonra tablo üzerinden tek tek ekleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-white/[0.01]">
        <button
          onClick={handleBulkAdd}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-[#11F08E] text-[#0d1117] hover:bg-[#0fd880] active:scale-[0.98] transition-all font-black text-sm uppercase tracking-widest shadow-[0_10px_30px_rgba(17,240,142,0.2)]"
        >
          <PlusCircle className="w-5 h-5" />
          Kuyruğa 10 Adet Ekle
        </button>
      </div>
    </div>
  );
}

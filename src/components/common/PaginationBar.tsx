import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface PaginationBarProps {
  totalItems: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, currentPage * pageSize)

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  return (
    <div
      className={`w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 pb-2 px-3 border-t border-[#4a443f]/60 text-xs text-[#a69f99] select-none ${className}`}
    >
      {/* Sol: Toplam Kayıt ve Gösterilen Aralık */}
      <div className="text-center sm:text-left text-[11px] sm:text-xs text-[#8c857f] shrink-0 font-medium">
        <span>Toplam </span>
        <span className="font-mono text-white font-semibold">{totalItems}</span>
        <span> kayıt</span>
        {totalItems > 0 && (
          <span className="hidden md:inline text-[#716a64] ml-1.5">
            ({startItem}-{endItem} arası)
          </span>
        )}
      </div>

      {/* Orta: Ortalı Sayfa Numaralandırması ve Butonlar */}
      <div className="flex items-center justify-center gap-1.5 shrink-0 mx-auto">
        {/* İlk Sayfa */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="p-1 rounded-lg hover:bg-white/10 text-[#d6beae] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title="İlk Sayfa"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Önceki Sayfa */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg bg-[#282522] hover:bg-[#34302d] border border-[#4a443f] text-[#d6beae] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all shadow-xs"
          title="Önceki Sayfa"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Sayfa Göstergesi */}
        <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#282522]/80 border border-[#4a443f] text-xs">
          <span>Sayfa</span>
          <span className="font-mono text-white font-bold px-1">{currentPage}</span>
          <span className="text-[#8c857f]">/</span>
          <span className="font-mono text-[#d6beae] font-semibold">{totalPages}</span>
        </div>

        {/* Sonraki Sayfa */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg bg-[#282522] hover:bg-[#34302d] border border-[#4a443f] text-[#d6beae] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all shadow-xs"
          title="Sonraki Sayfa"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Son Sayfa */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1 rounded-lg hover:bg-white/10 text-[#d6beae] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title="Son Sayfa"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sağ: Gösterim Sayısı Seçimi (Göster 20 - Sayı Code Fontunda) */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <span className="text-xs text-[#a69f99] font-medium">Göster</span>
        <div className="inline-flex items-center p-0.5 rounded-xl bg-[#282522] border border-[#4a443f] shadow-xs">
          {pageSizeOptions.map((opt) => {
            const isSelected = pageSize === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onPageSizeChange(opt)
                  onPageChange(1)
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#b99881] text-[#1c1917] shadow-xs scale-102'
                    : 'text-[#d6beae] hover:text-white hover:bg-white/5'
                }`}
                title={`Sayfa başına ${opt} kayıt göster`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

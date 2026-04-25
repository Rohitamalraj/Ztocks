"use client"

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  snapPoints?: number[] // Percentage heights: [50, 100]
}

export function BottomSheet({ isOpen, onClose, children, snapPoints = [50, 100] }: BottomSheetProps) {
  const [snapIndex, setSnapIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    setStartY(clientY)
    setCurrentY(clientY)
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return
    setCurrentY(clientY)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    
    const dragDistance = currentY - startY
    const threshold = 100
    
    if (dragDistance > threshold) {
      // Dragged down - close or snap to lower point
      if (snapIndex === 0) {
        onClose()
      } else {
        setSnapIndex(snapIndex - 1)
      }
    } else if (dragDistance < -threshold) {
      // Dragged up - snap to higher point
      if (snapIndex < snapPoints.length - 1) {
        setSnapIndex(snapIndex + 1)
      }
    }
  }

  if (!isOpen) return null

  const currentHeight = snapPoints[snapIndex]

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background glass rounded-t-2xl shadow-2xl transition-all duration-300"
        style={{
          height: `${currentHeight}vh`,
          transform: isDragging ? `translateY(${Math.max(0, currentY - startY)}px)` : 'translateY(0)'
        }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseMove={(e) => handleDragMove(e.clientY)}
        onMouseUp={handleDragEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="h-full overflow-y-auto pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

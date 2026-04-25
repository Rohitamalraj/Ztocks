"use client"

import React from 'react'

interface TradingLayoutProps {
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
  bottomPanel: React.ReactNode
}

export function TradingLayout({ leftPanel, centerPanel, rightPanel, bottomPanel }: TradingLayoutProps) {
  return (
    <div className="w-full max-w-[1920px] mx-auto">
      {/* Desktop: 3-column grid with bottom panel (>1024px) */}
      <div className="hidden lg:block p-6">
        <div className="grid grid-cols-[320px_1fr_360px] gap-6 mb-6">
          {/* Markets Panel */}
          <div className="h-[calc(100vh-240px)] overflow-hidden">
            {leftPanel}
          </div>
          
          {/* Chart Panel */}
          <div className="h-[calc(100vh-240px)] overflow-hidden">
            {centerPanel}
          </div>
          
          {/* Trade Form Panel */}
          <div className="h-[calc(100vh-240px)] overflow-hidden">
            {rightPanel}
          </div>
        </div>
        
        {/* Positions Panel (full width bottom) */}
        <div className="h-[260px] overflow-hidden">
          {bottomPanel}
        </div>
      </div>

      {/* Tablet: 2-column grid (768-1024px) */}
      <div className="hidden md:block lg:hidden p-6">
        <div className="grid grid-cols-[320px_1fr] gap-6 mb-6">
          {/* Markets Panel */}
          <div className="h-[calc(100vh-240px)] overflow-hidden">
            {leftPanel}
          </div>
          
          {/* Chart Panel */}
          <div className="h-[calc(100vh-240px)] overflow-hidden">
            {centerPanel}
          </div>
        </div>
        
        {/* Trade Form + Positions (stacked) */}
        <div className="grid grid-cols-1 gap-6">
          <div className="h-[400px] overflow-hidden">
            {rightPanel}
          </div>
          <div className="h-[260px] overflow-hidden">
            {bottomPanel}
          </div>
        </div>
      </div>

      {/* Mobile: Vertical stack (<768px) */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        {/* Chart Panel */}
        <div className="h-[400px] overflow-hidden">
          {centerPanel}
        </div>
        
        {/* Trade Form */}
        <div className="h-[400px] overflow-hidden">
          {rightPanel}
        </div>
        
        {/* Markets Panel */}
        <div className="h-[400px] overflow-hidden">
          {leftPanel}
        </div>
        
        {/* Positions Panel */}
        <div className="h-[300px] overflow-hidden">
          {bottomPanel}
        </div>
      </div>
    </div>
  )
}

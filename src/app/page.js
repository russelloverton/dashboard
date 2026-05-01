'use client';

import { useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary';
import ThemeToggle from '@/components/ThemeToggle';
import Clock from '@/components/Clock';
import Weather from '@/components/Weather';
import ServiceHealth from '@/components/ServiceHealth';
import MinifluxFeed from '@/components/MinifluxFeed';
import NextcloudCalendar from '@/components/NextcloudCalendar';
import SuperProductivity from '@/components/SuperProductivity';
import ImmichStats from '@/components/ImmichStats';
import SystemStats from '@/components/SystemStats';
import Bookmarks from '@/components/Bookmarks';
import AILauncher from '@/components/AILauncher';
import StirlingDropZone from '@/components/StirlingDropZone';

export default function DashboardPage() {
  const config = useConfig();

  useEffect(() => {
    if (config?.dashboard?.title) document.title = config.dashboard.title;
  }, [config]);

  return (
    <div className="dashboard">
      {/* ── Top bar: bookmarks + theme toggle ── */}
      <header className="topbar">
        <Clock />
        <nav className="topbar-nav">
          <Bookmarks />
        </nav>
        <ThemeToggle />
      </header>

      {/* ── Main content area ── */}
      <main className="main-board">
        
        {/* Column 1: Wide / Hero content */}
        <div className="board-col board-col-wide">
          <WidgetErrorBoundary name="Weather"><Weather /></WidgetErrorBoundary>
          <WidgetErrorBoundary name="Calendar"><NextcloudCalendar /></WidgetErrorBoundary>
        </div>

        {/* Column 2: Lists / Feed */}
        <div className="board-col board-col-mid">
          <WidgetErrorBoundary name="Headlines"><MinifluxFeed /></WidgetErrorBoundary>
          <WidgetErrorBoundary name="Tasks"><SuperProductivity /></WidgetErrorBoundary>
        </div>

        {/* Column 3: System & Services */}
        <div className="board-col board-col-side">
          <WidgetErrorBoundary name="System"><SystemStats /></WidgetErrorBoundary>
          <WidgetErrorBoundary name="Services"><ServiceHealth /></WidgetErrorBoundary>
          
          <div className="side-mini-stack">
            <WidgetErrorBoundary name="Photos"><ImmichStats /></WidgetErrorBoundary>
            <WidgetErrorBoundary name="AI Launcher"><AILauncher /></WidgetErrorBoundary>
            <WidgetErrorBoundary name="Stirling PDF"><StirlingDropZone /></WidgetErrorBoundary>
          </div>
        </div>

      </main>
    </div>
  );
}

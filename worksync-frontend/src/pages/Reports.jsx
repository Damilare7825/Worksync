import React from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { AnalyticsCharts } from '../components/analytics/AnalyticsCharts';
import { StatCard } from '../components/dashboard/StatCard';
import { useWorkSync } from '../context/WorkSyncContext';

export function Reports() {
  const { tasks, projects, team, loading } = useWorkSync();

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = tasks.filter((t) => t.due && t.status !== 'done' && new Date(t.due) < new Date()).length;
  const stats = [
    { label: 'Total Tasks', value: tasks.length, sub: 'Across all projects' },
    { label: 'Completed', value: completedCount, sub: `${tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}% completion rate` },
    { label: 'Overdue', value: overdueCount, sub: 'Past due date' },
    { label: 'Team Members', value: team.length, sub: `${projects.length} active projects` }
  ];

  if (loading) {
    return (
      <AppLayout title="Reports & Analytics" subtitle="Performance KPIs and team productivity trends">
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reports & Analytics" subtitle="Performance KPIs and team productivity trends">
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>
        <AnalyticsCharts />
      </div>
    </AppLayout>
  );
}

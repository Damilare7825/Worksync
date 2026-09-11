# Phase 23: Performance & Database Optimization - Backend Query Analysis

## Overview
Analysis of backend Prisma queries for over-fetching and N+1 patterns in key service files as part of WorkSync Phase 23 optimization work.

## Files Analyzed
- task.service.js
- project.service.js
- notification.service.js
- user.service.js
- dashboard.service.js
- analytics.service.js

## Key Findings

### 1. task.service.js - Over-fetching Concerns

#### listTasks function (lines 117-181)
**Issue**: The `findMany` query includes extensive related data that may not be needed for list views:
```javascript
include: {
  labels: { include: { label: true } },
  _count: { select: { subtasks: true, checklistItems: true, watchers: true } },
}
```
**Impact**: Fetching label objects and nested label data when list views might only need label IDs or counts.

**Optimization Opportunity**: 
- Create a lightweight select for list views that only fetches essential fields
- Consider separating list view queries from detail view queries
- The `_count` for subtasks/checklistItems/watchers is actually appropriate for list views

#### Subtask Completion Count (lines 167-178)
**Issue**: Additional `groupBy` query to calculate subtask completion counts:
```javascript
const completedCounts = await prisma.task.groupBy({
  by: ['parentTaskId'],
  where: { parentTaskId: { in: parentIds }, status: 'COMPLETED' },
  _count: { _all: true },
});
```
**Assessment**: This is actually efficient - a single groupBy query rather than N individual queries. Well implemented.

#### updateTask function (lines 275-389)
**Issue**: Multiple individual `logActivity` calls in a loop (lines 354-363):
```javascript
for (const event of changeEvents) {
  await logActivity({ ... }); // Potential for multiple DB writes
}
```
**Impact**: If a task update touches many fields, this could result in multiple activity log entries created sequentially.

**Optimization Opportunity**:
- Batch activity log creation when multiple changes occur in a single update
- Consider creating a single consolidated activity log entry for related changes

#### bulkUpdateTasks function (lines 519-598)
**Issue**: Individual task processing in loops:
1. Lines 549-595: Individual `prisma.task.update()` calls in a loop
2. Lines 572-577: Individual label add/remove operations in a loop

**Impact**: O(n) database operations where n = number of tasks being bulk updated

**Optimization Opportunity**:
- Investigate if Prisma batch operations or raw SQL could improve performance
- Consider transaction batching for label operations

### 2. notification.service.js - Repeated Preference Fetching

#### createNotification function (lines 17-49)
**Issue**: Always fetches user notification preferences:
```javascript
const preferences = await userService.getOrCreateNotificationPreferences(userId);
```
**Impact**: If this function is called frequently (e.g., during high-activity periods), it repeatedly fetches the same preferences for the same user.

**Optimization Opportunity**:
- Consider caching notification preferences per user during a request/scoped period
- Pass preferences as a parameter when available from the calling context

### 3. dashboard.service.js - Similar Query Patterns

#### getDashboardStats function (lines 7-73)
**Observation**: Makes 8 separate queries with very similar WHERE clauses:
- All use `baseWhere = { assigneeId: userId, project: { status: { not: 'ARCHIVED' } } }`
- Only minor variations in status filters, date ranges, and selection fields

**Assessment**: Currently executes in parallel via `Promise.all()`, which is good. 
However, there may be opportunities to consolidate some of these queries.

### 4. General Patterns

**Positive Findings**:
- Most functions properly use `Promise.all()` for parallel execution where appropriate
- Proper use of indexes was verified in the migration just completed
- Authorization checks are properly implemented
- No clear N+1 query patterns found in the analyzed files (good news!)

## Recommendations for Phase 23 Optimization

### Immediate Actions (Low Risk, High Impact)
1. **Optimize task.service.js listTasks**: Create a lightweight select option for list views that excludes unnecessary nested data
2. **Batch activity logs in updateTask**: Consolidate multiple logActivity calls when updating multiple fields on a single task
3. **Cache notification preferences**: Implement request-scoped caching for notification preferences in createNotification

### Medium-Term Considerations
1. **Investigate bulk task updates**: Explore if task bulk updates can be optimized beyond individual queries
2. **Dashboard query consolidation**: Analyze if some of the 8 similar dashboard queries can be combined
3. **Label operation batching**: Look into batching label add/remove operations in bulk updates

### Files to Examine Next
Based on the Phase 23 checklist, also examine:
- activity.service.js (for activity log patterns)
- team.service.js, workspace.service.js, invitation.service.js
- Any services with frequent read operations in loops

## Verification Approach
Before implementing any optimizations:
1. Measure current performance with representative datasets
2. Create benchmarks for key operations
3. Verify optimizations don't break functionality through existing test suite
4. Measure performance after changes to confirm improvements

## Conclusion
The codebase shows good practices overall with minimal N+1 query issues. Optimization opportunities exist in:
- Reducing over-fetching in list queries
- Batching related operations
- Caching frequently accessed reference data
- Consolidating similar query patterns
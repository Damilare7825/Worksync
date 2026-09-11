# WORKSYNC PHASE 21 IMPLEMENTATION PLAN
# USER PROFILES & PREFERENCES

## EXISTING FUNCTIONALITY TO PRESERVE & INTEGRATE

### BACKEND:
- User model with: id, name, email, passwordHash, avatar (String?), createdAt, updatedAt
- User service: getUserById, updateOwnProfile, deleteOwnAccount
- User controller: GET/PUT/DELETE /me, GET /:id
- Auth service: POST /auth/change-password (already working)
- Notification service: createNotification, listNotifications, markNotificationRead, markAllNotificationsRead
- Notification controller/routes: GET/notifications, PATCH/notifications/:id/read, PATCH/notifications/read-all

### FRONTEND:
- Settings page with: profile editing (name), password change, workspace settings
- AuthContext: manages auth state, user, workspaces
- WorkSyncContext: manages app state (projects, tasks, notifications, etc.)
- userApi.updateProfile: PUT /users/me
- authApi.changePassword: POST /auth/change-password
- notificationApi: list, markRead, markAllRead
- Avatar display system already works (shows user.avatar or initials)
- Settings page UI framework (Cards, Inputs, Buttons, loading/success states)

## MISSING FUNCTIONALITY TO IMPLEMENT

### DATABASE CHANGES (Backend)
1. **Add bio field to User model**:
   - Add `bio String?` to User model in schema.prisma
   - Run migration to add column

2. **Create UserPreference model** (or add fields to User):
   - Option A (Separate model - cleaner):
     - model UserPreference {
       - id String @id @default(uuid())
       - userId String @unique
       - theme Enum(LIGHT, DARK, SYSTEM) @default(SYSTEM)
       - timezone String @default("UTC")
       - dateFormat String @default("MM/dd/yyyy")
       - timeFormat String @default("hh:mm a")
       - compactDensity Boolean @default(false)
       - createdAt DateTime @default(now())
       - updatedAt DateTime @updatedAt
       - user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     }
   - Option B (Add to User model - simpler):
     - Add theme, timezone, dateFormat, timeFormat, compactDensity fields to User model

3. **Create NotificationPreference model**:
   - model NotificationPreference {
     - id String @id @default(uuid())
     - userId String @unique
     - taskAssignments Boolean @default(true)
     - taskUpdates Boolean @default(true)
     - dueDateReminders Boolean @default(true)
     - mentions Boolean @default(true)
     - comments Boolean @default(true)
     - replies Boolean @default(true)
     - reactions Boolean @default(true)
     - workspaceActivity Boolean @default(true)
     - projectActivity Boolean @default(true)
     - invitations Boolean @default(true)
     - createdAt DateTime @default(now())
     - updatedAt DateTime @updatedAt
     - user User @relation(fields: [userId], references: [id], onDelete: Cascade)
   }

### API CHANGES (Backend)

1. **Enhance User Update**:
   - Update updateProfileSchema in user.validator.js to include bio field
   - Ensure avatar field continues to work with existing validation

2. **Avatar Management Endpoints**:
   - POST /users/me/avatar - upload/update avatar
   - DELETE /users/me/avatar - remove avatar
   - Use existing attachment/storage services
   - Validate image types and size limits

3. **Preference Management Endpoints**:
   - GET /users/me/preferences - get user preferences
   - PATCH /users/me/preferences - update user preferences
   - GET /users/me/notification-preferences - get notification preferences
   - PATCH /users/me/notification-preferences - update notification preferences

4. **Notification Service Enhancement**:
   - Modify createNotification to check user preferences before creating notification
   - Skip notification creation if user has disabled that notification type

### FRONTEND CHANGES

1. **Enhance Settings Page**:
   - Add avatar upload section with preview
   - Add bio/about textarea field
   - Add notification preferences section with checkboxes
   - Add theme preferences section (radio buttons: Light/Dark/System)
   - Add other preferences (timezone, date/time format, density)
   - Maintain existing UI patterns (loading, success/error states)

2. **State Management Enhancement**:
   - Extend AuthContext or create PreferenceContext to store user preferences
   - Load preferences on auth bootstrap
   - Update preferences when changed
   - Apply theme preference globally (could use CSS variables or tailwind config)

3. **API Service Extensions**:
   - Extend userApi with:
     - uploadAvatar: (file) => http.post('/users/me/avatar', file)
     - deleteAvatar: () => http.delete('/users/me/avatar')
     - getPreferences: () => http.get('/users/me/preferences')
     - updatePreferences: (data) => http.patch('/users/me/preferences', data)
     - getNotificationPreferences: () => http.get('/users/me/notification-preferences')
     - updateNotificationPreferences: (data) => http.patch('/users/me/notification-preferences', data)
   - Extend notificationApi if needed

4. **UI Integration**:
   - Ensure uploaded avatars are stored via existing attachment system
   - Apply theme preference to change app appearance
   - Respect notification preferences in WorkSyncContext notification handling
   - Show auth user avatar in navbar/menu consistently

## IMPLEMENTATION APPROACH

### Phase 1: Database & Backend API
1. Add bio field to User model
2. Create UserPreference and NotificationPreference models
3. Generate and run migration
4. Enhance user validation and controller for bio field
5. Implement avatar upload/delete endpoints
6. Implement preference management endpoints
7. Enhance notification service to respect preferences

### Phase 2: Frontend Implementation
1. Extend userApi with new endpoint methods
2. Enhance AuthContext to manage preferences
3. Redesign Settings page with all new sections
4. Implement avatar upload UI
5. Implement theme preference application
6. Connect notification preferences to backend logic

### Phase 3: Integration & Testing
1. Test avatar upload/removal workflow
2. Test preference persistence
3. Test notification preference enforcement
4. Test theme persistence across sessions
5. Regression test existing functionality
6. Run all existing tests to ensure nothing broken

## KEY DECISIONS

1. **Preference Storage Approach**: Use separate UserPreference and NotificationPreference models linked to User for clean separation and easier future expansion

2. **Avatar Storage**: Reuse existing attachment system - store avatar as an Attachment entity linked to user, store attachment URL in User.avatar field

3. **Theme Implementation**: Use CSS variables with Tailwind to support dynamic theme switching, store preference in database, apply on app load

4. **Notification Preferences**: Check preferences in notification service before creating notifications - server-side enforcement

5. **Backwards Compatibility**: All changes are additive - existing functionality preserved
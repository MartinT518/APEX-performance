# Testing Checklist - APEX Performance

## Test Environment Setup
- [x] Supabase project created
- [x] Environment variables configured
- [x] Database migration executed
- [x] Authentication enabled

---

## 1. Authentication Flow Tests

### 1.1 User Registration
- [ ] Navigate to home page (`/`)
- [ ] Click "Sign Up" or switch to signup form
- [ ] Enter email and password
- [ ] Submit form
- [ ] Verify: User redirected to dashboard or settings
- [ ] Verify: User menu shows email
- [ ] Verify: User can access protected routes

### 1.2 User Login
- [ ] Logout if logged in
- [ ] Navigate to home page
- [ ] Enter credentials
- [ ] Submit login form
- [ ] Verify: Successful login
- [ ] Verify: Redirected to dashboard
- [ ] Verify: Session persists on page refresh

### 1.3 Authentication Guard
- [ ] Logout
- [ ] Try to access `/dashboard` directly
- [ ] Verify: Redirected to home page
- [ ] Verify: Cannot access protected routes without auth

### 1.4 Logout
- [ ] Click logout in user menu
- [ ] Verify: Logged out successfully
- [ ] Verify: Redirected to home page
- [ ] Verify: Cannot access protected routes

---

## 2. Phenotype Configuration Tests

### 2.1 Profile Auto-Creation
- [ ] Login with new user
- [ ] Navigate to Settings (`/settings`)
- [ ] Verify: Default profile loads automatically
- [ ] Verify: Profile has valid UUID (not mock ID)
- [ ] Verify: Default values are set correctly

### 2.2 Update Max HR
- [ ] Change Max HR value
- [ ] Save/Update
- [ ] Verify: Value persists in UI
- [ ] Refresh page
- [ ] Verify: Value loads from Supabase
- [ ] Check Supabase table: Verify value in database

### 2.3 Update Threshold HR
- [ ] Enter Threshold HR value
- [ ] Save
- [ ] Verify: Value persists
- [ ] Refresh page
- [ ] Verify: Value loads correctly

### 2.4 Update Structural Weakness
- [ ] Select structural weaknesses
- [ ] Save
- [ ] Verify: Selections persist
- [ ] Refresh page
- [ ] Verify: Selections load correctly

### 2.5 Update Lift Days Required
- [ ] Change lift days required
- [ ] Save
- [ ] Verify: Value persists
- [ ] Refresh page
- [ ] Verify: Value loads correctly

### 2.6 Toggle High-Rev Mode
- [ ] Toggle High-Rev mode checkbox
- [ ] Verify: State updates immediately
- [ ] Refresh page
- [ ] Verify: State persists

---

## 3. Daily Monitoring Tests

### 3.1 Niggle Score Entry
- [ ] Navigate to Dashboard
- [ ] Enter niggle score via slider
- [ ] Verify: Score updates in UI
- [ ] Refresh page
- [ ] Verify: Score loads from Supabase
- [ ] Check Supabase `daily_monitoring` table

### 3.2 Strength Session Logging
- [ ] Click "Did you lift?" toggle
- [ ] Select intensity tier (Mobility/Hypertrophy/Strength/Power)
- [ ] Verify: Session logged
- [ ] Verify: Last lift date updates
- [ ] Refresh page
- [ ] Verify: Data persists
- [ ] Check `daysSinceLastLift` calculation

### 3.3 Fueling Log Entry
- [ ] Enter carbs per hour
- [ ] Set GI distress rating
- [ ] Verify: Data saves
- [ ] Refresh page
- [ ] Verify: Data loads correctly

### 3.4 Daily Monitoring Persistence
- [ ] Enter all daily monitoring data
- [ ] Refresh page
- [ ] Verify: All data loads correctly
- [ ] Check Supabase table: Verify all fields populated

---

## 4. Gatekeeper Prompt Tests

### 4.1 Blocking Behavior
- [ ] Logout and login (or clear niggle score)
- [ ] Navigate to Plan page (`/plan`)
- [ ] Verify: Gatekeeper modal appears
- [ ] Verify: Cannot dismiss without entering score
- [ ] Verify: Plan content is blurred/blocked

### 4.2 Score Entry
- [ ] Enter niggle score in gatekeeper modal
- [ ] Verify: Modal closes
- [ ] Verify: Plan content becomes visible
- [ ] Refresh page
- [ ] Verify: No gatekeeper prompt (score already entered)

---

## 5. Coach Analysis Tests

### 5.1 Run Analysis
- [ ] Navigate to Dashboard
- [ ] Ensure daily check-in completed
- [ ] Click "Run Coach Analysis"
- [ ] Verify: Loading state shows
- [ ] Verify: Analysis completes
- [ ] Verify: Results display

### 5.2 Agent Decisions Display
- [ ] After analysis runs
- [ ] Verify: Decision log shows agent votes
- [ ] Verify: Each agent shows correct vote (GREEN/YELLOW/RED)
- [ ] Verify: Reasoning text displays
- [ ] Click "Why this plan?" button
- [ ] Verify: Decision log dialog opens
- [ ] Verify: All agent votes visible

### 5.3 Certainty Score Display
- [ ] After analysis runs
- [ ] Verify: Certainty score displays
- [ ] Verify: Confidence level shows (LOW/MEDIUM/HIGH)
- [ ] Verify: Success probability percentage visible

### 5.4 Analysis Result Metadata
- [ ] After analysis runs
- [ ] Verify: Data source badge shows (GARMIN/SIMULATION/NONE)
- [ ] Verify: Activity name displays (if available)
- [ ] Verify: Timestamp shows

---

## 6. Data Persistence Tests

### 6.1 Cross-Session Persistence
- [ ] Complete full workflow: phenotype config, daily monitoring, analysis
- [ ] Logout
- [ ] Login again
- [ ] Verify: All data loads correctly
- [ ] Verify: Profile loads from Supabase
- [ ] Verify: Daily monitoring loads
- [ ] Verify: Baselines load

### 6.2 Supabase Table Verification
- [ ] Check `phenotype_profiles` table
- [ ] Verify: User's profile exists with correct data
- [ ] Check `daily_monitoring` table
- [ ] Verify: Today's entry exists
- [ ] Check `baseline_metrics` table
- [ ] Verify: Metrics are being saved

### 6.3 Local Storage Fallback
- [ ] Disconnect from internet
- [ ] Try to use app
- [ ] Verify: App still works (uses localStorage)
- [ ] Verify: Data syncs when connection restored

---

## 7. Error Handling Tests

### 7.1 Invalid Inputs
- [ ] Try to enter invalid Max HR (>220)
- [ ] Verify: Validation error shows
- [ ] Try to enter negative niggle score
- [ ] Verify: Validation prevents invalid input

### 7.2 Network Errors
- [ ] Simulate network failure
- [ ] Try to save phenotype config
- [ ] Verify: Error message displays
- [ ] Verify: App doesn't crash
- [ ] Verify: Data saved locally (will sync later)

### 7.3 Authentication Errors
- [ ] Try to access protected route without auth
- [ ] Verify: Redirected to login
- [ ] Try invalid credentials
- [ ] Verify: Error message shows

---

## 8. UI/UX Tests

### 8.1 Loading States
- [ ] Trigger async operations
- [ ] Verify: Loading indicators show
- [ ] Verify: Buttons disabled during loading

### 8.2 Responsive Design
- [ ] Test on mobile viewport
- [ ] Verify: Layout adapts correctly
- [ ] Verify: All components accessible

### 8.3 Navigation
- [ ] Navigate between pages
- [ ] Verify: Sidebar navigation works
- [ ] Verify: Active route highlighted
- [ ] Verify: User menu accessible

---

## Test Results Summary

**Date**: _____________  
**Tester**: _____________  
**Environment**: Development / Production

### Passed Tests: ___ / ___
### Failed Tests: ___ / ___
### Issues Found: ___

### Critical Issues:
1. 
2. 
3. 

### Minor Issues:
1. 
2. 
3. 

---

**Next Steps After Testing**:
- Fix any critical issues found
- Document any bugs in error registry
- Proceed to next development phase


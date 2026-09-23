# Test Cases - Social Media Dashboard

## Overview

This document contains test cases for the Social Media Dashboard application covering authentication, onboarding, account connections, dashboard analytics, and edge cases.

---

## 1. Authentication

| ID    | Test Case                          | Steps                                                                                                      | Expected Result                                                |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| TC-01 | Register with valid email/password | 1. Navigate to signup<br>2. Enter name, email, password (≥6 chars), confirm password<br>3. Click "Sign up" | User created, redirected to interests selection                |
| TC-02 | Register with existing email       | 1. Navigate to signup<br>2. Enter already registered email<br>3. Submit form                               | Error: "Email already exists"                                  |
| TC-03 | Register with short password       | 1. Navigate to signup<br>2. Enter password < 6 characters<br>3. Submit form                                | Error: "Password must be at least 6 characters"                |
| TC-04 | Login with correct credentials     | 1. Enter registered email<br>2. Enter correct password<br>3. Click "Login"                                 | User logged in, token stored in localStorage                   |
| TC-05 | Login with wrong password          | 1. Enter registered email<br>2. Enter incorrect password<br>3. Click "Login"                               | Error: "Login failed"                                          |
| TC-06 | Login with unregistered email      | 1. Enter unregistered email<br>2. Enter any password<br>3. Click "Login"                                   | Error: "Login failed"                                          |
| TC-07 | Logout                             | 1. Click logout button<br>2. Confirm logout                                                                | User logged out, auth_token and user removed from localStorage |

---

## 2. Interests Selection

| ID    | Test Case                                    | Steps                                                                                                   | Expected Result                                                |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| TC-08 | New user signup → select interests           | 1. Register new account<br>2. Select ≥1 interest<br>3. Click "Save Interests"                           | Interests saved to user profile, proceed to onboarding         |
| TC-09 | New user signup → skip interests             | 1. Register new account<br>2. Click "Skip" button                                                       | Empty interests saved, proceed to onboarding                   |
| TC-10 | Returning login → no interests → no trending | 1. Login as user with empty interests<br>2. Navigate to Dashboard<br>3. Observe Trending Topics section | Interests selection shown in Trending section (no Skip button) |
| TC-11 | Returning login → has interests              | 1. Login as user with interests set<br>2. Navigate to Dashboard                                         | No interests selection prompt shown                            |

---

## 3. Onboarding & Account Connection

| ID    | Test Case                               | Steps                                                                                                    | Expected Result                                                            |
| ----- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TC-12 | New user (no accounts) → see Onboarding | 1. Register new account<br>2. Complete interests (or skip)<br>3. Observe main content                    | Onboarding screen with "Connect Meta" button shown                         |
| TC-13 | Connect Meta - OAuth popup              | 1. Click "Connect Meta"<br>2. Observe popup                                                              | Meta login page opens in popup                                             |
| TC-14 | Complete Meta OAuth                     | 1. Complete TC-13<br>2. Login to Meta in popup<br>3. Approve permissions<br>4. Wait for popup to close   | Instagram/Facebook connected, Dashboard displayed with connected platforms |
| TC-15 | Connect YouTube - OAuth popup           | 1. Click "Connect YouTube"<br>2. Observe popup                                                           | Google login page opens in popup                                           |
| TC-16 | Complete YouTube OAuth                  | 1. Complete TC-15<br>2. Login to Google in popup<br>3. Approve permissions<br>4. Wait for popup to close | YouTube connected, Subscribers KPI appears in dashboard                    |
| TC-17 | Disconnect Meta                         | 1. Ensure Meta connected<br>2. Click "Disconnect Meta"<br>3. Confirm disconnect                          | Meta accounts removed, returned to Onboarding if no other accounts         |
| TC-18 | Disconnect YouTube                      | 1. Ensure YouTube connected<br>2. Click "Disconnect YouTube"<br>3. Confirm disconnect                    | YouTube account removed, Subscribers KPI hidden                            |

---

## 4. Dashboard & Analytics

| ID    | Test Case                             | Steps                                                          | Expected Result                                                      |
| ----- | ------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| TC-19 | View Dashboard with Meta connected    | 1. Connect Meta account<br>2. Navigate to Dashboard            | Followers, Reach, Engagement Rate KPIs displayed                     |
| TC-20 | View Dashboard with YouTube connected | 1. Connect YouTube account<br>2. Navigate to Dashboard         | Subscribers KPI added to KPIs                                        |
| TC-21 | View Dashboard with both connected    | 1. Connect both Meta and YouTube<br>2. Navigate to Dashboard   | All 4 KPIs shown: Followers, Reach, Engagement Rate, Subscribers     |
| TC-22 | View Connected Platforms section      | 1. Connect any platform<br>2. Observe Connected Platforms card | Platform cards with platform name, connection status, follower count |
| TC-23 | View Recent Posts (Meta)              | 1. Connect Meta<br>2. Observe Connected Platforms section      | Posts displayed with caption, likes, comments, timestamp             |
| TC-24 | View Recent Posts (YouTube)           | 1. Connect YouTube<br>2. Observe Connected Platforms section   | Videos displayed with thumbnail, title, views, likes                 |

---

## 5. Trending Topics

| ID    | Test Case                           | Steps                                                                                                        | Expected Result                                |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| TC-25 | User has interests → fetch trending | 1. Set user interests (e.g., Technology, Business)<br>2. Navigate to Dashboard<br>3. Observe Trending Topics | Topics related to selected interests displayed |
| TC-26 | User no interests → fetch trending  | 1. User with empty interests<br>2. Navigate to Dashboard<br>3. Observe Trending Topics                       | Fallback to general/mock topics displayed      |

---

## 6. Edge Cases

| ID    | Test Case                            | Steps                                                                       | Expected Result                         |
| ----- | ------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------- |
| TC-27 | Access protected route without token | 1. Clear auth_token from localStorage<br>2. Attempt to access /api/accounts | 401 Unauthorized response               |
| TC-28 | Token expired → automatic logout     | 1. Set expired token in localStorage<br>2. Refresh page                     | User redirected to login, token cleared |
| TC-29 | YouTube OAuth cancelled              | 1. Click "Connect YouTube"<br>2. Close popup without completing             | Stay on current page, no error message  |
| TC-30 | Meta OAuth cancelled                 | 1. Click "Connect Meta"<br>2. Close popup without completing                | Stay on current page, no error message  |

---

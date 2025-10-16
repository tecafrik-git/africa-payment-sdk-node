# Design Document

## Overview

This design separates the existing monolithic CI/CD pipeline into two distinct jobs within a single GitHub Actions workflow: a Build job and a Publish job. The Build job will run on all pushes and pull requests to validate code quality, while the Publish job will conditionally run only on direct pushes to the main branch (excluding pull requests) to control package releases.

## Architecture

### Workflow Structure

We will modify the existing workflow file (pipeline.yml) to contain two separate jobs:

1. **build** - Runs on all workflow triggers (pushes and pull requests to main)
2. **publish** - Runs only when the event is a push (not a pull request) and depends on the build job

### Workflow Triggers

The workflow will trigger on both push and pull_request events:

```yaml
on:
  push:
    branches: ['main']
  pull_request:
    branches: ['main']
```

### Job Conditional Execution

The publish job will use a conditional `if` statement to skip execution on pull requests:

```yaml
if: github.event_name == 'push'
```

This ensures the publish job only runs when the workflow is triggered by a push event, not a pull_request event.

### Job Dependencies

The Publish job will depend on the Build job using the `needs` keyword:

```yaml
publish:
  needs: build
  if: github.event_name == 'push'
```

This ensures:
1. The publish job only runs after the build job completes successfully
2. If the build job fails, the publish job will not run
3. The publish job is skipped entirely on pull request events

## Components and Interfaces

### Pipeline Workflow (pipeline.yml)

**Purpose:** Validate code quality and publish packages

**Triggers:**
- Push to main branch
- Pull requests targeting main branch

### Build Job

**Purpose:** Validate code quality on all changes and create build artifacts

**Runs on:** All workflow triggers (push and pull_request)

**Steps:**
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Run tests
5. Build the project
6. Upload build artifacts (dist/, package.json, README.md)

**Outputs:** Build artifacts uploaded to GitHub Actions for use by the publish job

### Publish Job

**Purpose:** Publish package to npm registry only on main branch pushes

**Runs on:** Only when `github.event_name == 'push'`

**Dependencies:** Requires the `build` job to complete successfully (using `needs: build`)

**Conditional:** `if: github.event_name == 'push'`

**Steps:**
1. Checkout code
2. Setup Node.js 18 with npm registry configuration
3. Download build artifacts from the build job
4. Publish to npm with public access

**Environment Variables:**
- `NODE_AUTH_TOKEN` - npm authentication token from GitHub secrets

**Rationale for using artifacts:** The publish job uses artifacts from the build job to avoid rebuilding and to ensure the exact same build that was tested is published to npm. This improves efficiency and guarantees consistency between what was validated and what is published.

## Data Models

### GitHub Actions Context

The workflow will use GitHub Actions context to determine the event type:

- `github.event_name` - Will be either "push" or "pull_request", used in the publish job's conditional
- `github.ref` - The branch reference being built

### Secrets

- `NPM_TOKEN` - Required secret for npm authentication during publish (used only in publish job)

## Error Handling

### Build Job Failures

- If any step fails (install, test, or build), the build job will fail and report status to GitHub
- Pull requests will show failed checks and prevent merging if required
- Push events will show failed status on the commit
- The publish job will not run if the build job fails (due to `needs: build` dependency)

### Publish Job Failures

- The publish job will be skipped on pull requests (not a failure, just skipped)
- If build steps in the publish job fail, publishing will not occur
- If npm publish fails, the workflow will fail and alert maintainers
- Failed publishes will not affect the main branch code but will require investigation

### Retry Strategy

- GitHub Actions will not automatically retry failed jobs
- Maintainers can manually re-run failed workflows from the Actions UI
- For transient npm registry issues, manual re-run is the recommended approach

## Testing Strategy

### Workflow Validation

1. **Pull Request Testing:**
   - Create a test PR and verify the build job runs
   - Verify the publish job is skipped on PR events
   - Confirm build status is reported correctly

2. **Main Branch Push Testing:**
   - Push directly to main (or merge a PR) and verify both jobs run
   - Confirm build job completes successfully
   - Confirm publish job runs after build job and publishes to npm
   - Verify package version is updated on npm registry

3. **Failure Scenarios:**
   - Introduce a failing test and verify build job fails
   - Verify publish job does not run when build job fails
   - Confirm error messages are clear and actionable

### Manual Testing Checklist

- [ ] Create a test branch and open a PR - verify only build job runs and publish job is skipped
- [ ] Merge the PR to main - verify both build and publish jobs run
- [ ] Check npm registry for the published package
- [ ] Verify workflow logs are clear and descriptive
- [ ] Test with a failing test to ensure proper error handling

## Migration Plan

1. Modify the existing `pipeline.yml` workflow file to separate build and publish into distinct jobs
2. Add the conditional `if: github.event_name == 'push'` to the publish job
3. Add the `needs: build` dependency to the publish job
4. Test with a pull request to verify build-only behavior
5. Test with a main branch push to verify both jobs run

## Security Considerations

- The `NPM_TOKEN` secret must be properly configured in GitHub repository settings
- The publish job should only have access to necessary secrets
- Consider using environment protection rules for the publish job to add manual approval gates if needed
- The conditional execution ensures publish only happens on push events, adding an extra layer of control

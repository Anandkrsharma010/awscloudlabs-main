    # AWS CLI Role Assumption Setup Guide

This guide helps you configure your AWS CLI to assume the CyberRangeLabManagerRole for the CyberRange labs.

## The Problem

Your current AWS CLI is using your IAM user credentials directly, but the CyberRangeLab needs you to assume the `CyberRangeLabManagerRole`.

When you run `aws sts get-caller-identity`, you see:
```
{
    "UserId": "AIDA3E3WMCQ6SUNKF7T32",
    "Account": "766363046973",
    "Arn": "arn:aws:iam::766363046973:user/aadhithya@iitm"
}
```

But you should see an assumed role ARN like:
```
{
    "Arn": "arn:aws:sts::766363046973:assumed-role/CyberRangeLabManagerRole/lab-session-..."
}
```

## Solution: Configure AWS CLI Profile for Role Assumption

### Step 1: Configure AWS Config File

Open your AWS config file:
- **Windows**: `%USERPROFILE%\.aws\config` (e.g., `C:\Users\aadhi\.aws\config`)
- **Mac/Linux**: `~/.aws/config`

Add the following profiles at the end of the file:

```
[profile cyberrange]
region = ap-south-1
output = json

[profile cyberrange-assume]
region = ap-south-1
output = json
source_profile = cyberrange
role_arn = arn:aws:iam::766363046973:role/CyberRangeLabManagerRole
role_session_name = cyberrange-session
duration_seconds = 3600
```

### Step 2: Configure AWS Credentials File

Open your AWS credentials file:
- **Windows**: `%USERPROFILE%\.aws\credentials` (e.g., `C:\Users\aadhi\.aws\credentials`)
- **Mac/Linux**: `~/.aws/credentials`

Add your IAM user credentials:

```
[cyberrange]
aws_access_key_id = YOUR_ACCESS_KEY_ID_HERE
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY_HERE
```

**Important**: Replace `YOUR_ACCESS_KEY_ID_HERE` and `YOUR_SECRET_ACCESS_KEY_HERE` with your actual AWS credentials from the AWS IAM Console.

### Step 3: Test Role Assumption

Run this command to verify your CLI is properly configured:

```
powershell
aws sts assume-role --role-arn "arn:aws:iam::766363046973:role/CyberRangeLabManagerRole" --role-session-name "test-session" --profile cyberrange
```

You should see output like:
```
json
{
    "Credentials": {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "...",
        "SessionToken": "...",
        "Expiration": "2026-02-24T..."
    }
}
```

If successful, verify the assumed identity:

```
powershell
aws sts get-caller-identity --profile cyberrange-assume
```

This should show:
- **Arn**: `arn:aws:sts::766363046973:assumed-role/CyberRangeLabManagerRole/...`
- **UserId**: `AROA...:...`

### Step 4: Use the Profile in Commands

Now you can use the `cyberrange-assume` profile in your terminal commands:

```
powershell
# List S3 buckets
aws s3 ls --profile cyberrange-assume

# List Lambda functions
aws lambda list-functions --profile cyberrange-assume

# List EC2 instances
aws ec2 describe-instances --profile cyberrange-assume
```

---

## Troubleshooting

### Issue: "User: arn:aws:iam::766363046973:user/aadhithya@iitm is not authorized to perform: sts:AssumeRole"

**Cause**: Your IAM user is not trusted to assume the role

**Fix**: Contact your AWS administrator to add your IAM user to the trust policy of `CyberRangeLabManagerRole`.

### Issue: "The security token included in the request is invalid"

**Cause**: CLI is not using the assumed role profile

**Fix**: Make sure you're using `--profile cyberrange-assume` in your commands, not `cyberrange`.

### Issue: "Invalid AWS Access Key ID"

**Cause**: Wrong or expired credentials in credentials file

**Fix**:
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam)
2. Verify your access key is "Active"
3. If not, create a new access key
4. Update your `.aws/credentials` file

### Issue: "SignatureDoesNotMatch"

**Cause**: Secret access key is incorrect

**Fix**:
1. Create new access key in IAM
2. Update the secret in your `.aws/credentials` file

### Issue: "Access Denied"

**Cause**: IAM user lacks permissions or role lacks permissions

**Fix**:
1. Go to IAM → Users → Your User
2. Add policy: `AdministratorAccess`
3. OR contact admin to update role's permissions boundary

---

## Summary

| Step | Action |
|------|--------|
| 1 | Add profiles to `.aws/config` |
| 2 | Add credentials to `.aws/credentials` |
| 3 | Test with `aws sts assume-role --profile cyberrange` |
| 4 | Verify with `aws sts get-caller-identity --profile cyberrange-assume` |
| 5 | Use `--profile cyberrange-assume` in all AWS commands |

---

## Need Help?

If you're still having issues, please share the error message you're receiving and I'll help you troubleshoot.

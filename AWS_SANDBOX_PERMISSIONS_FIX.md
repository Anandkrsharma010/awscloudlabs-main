# AWS Sandbox Permissions Fix Guide

## Problem

The CyberRangeLabManagerRole is failing with:
```
User: arn:aws:sts::766363046973:assumed-role/CyberRangeLabManagerRole/lab-session-xxx is not authorized to perform: iam:GetUser because no permissions boundary allows the iam:GetUser action
```

## Root Cause

The `CyberRangeLabManagerRole` in the AWS sandbox account (ID: `766363046973`) has a **permissions boundary** that restricts certain IAM operations.

## Required Permissions

To fix this, the sandbox administrator needs to update the permissions boundary for `CyberRangeLabManagerRole` to allow the following IAM actions:

### Minimum Required IAM Permissions:
```
json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowIAMReadOperations",
      "Effect": "Allow",
      "Action": [
        "iam:GetUser",
        "iam:GetRole",
        "iam:GetPolicy",
        "iam:ListUsers",
        "iam:ListRoles",
        "iam:ListPolicies",
        "iam:ListAttachedUserPolicies",
        "iam:ListUserPolicies",
        "iam:GetPolicyVersion",
        "iam:GetUserPolicy",
        "iam:ListAccessKeys"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowIAMWriteOperations",
      "Effect": "Allow",
      "Action": [
        "iam:AttachUserPolicy",
        "iam:DetachUserPolicy",
        "iam:PutUserPolicy",
        "iam:DeleteUserPolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

## Alternative: Full Lab Permissions Policy

I've created a more comprehensive secure policy in `secure-lab-iam-policy.json` that:
- Restricts access to lab-specific resources (prefixed with `lab-` or `Labs-`)
- Prevents destruction of lab infrastructure
- Allows the IAM privilege escalation lab to work properly

## Contact Your Admin

Please share this document with your AWS sandbox administrator and ask them to:

1. Find the `CyberRangeLabManagerRole` in the AWS IAM console
2. Locate the permissions boundary attached to this role
3. Add the IAM permissions listed above to the permissions boundary

## After Permissions Are Updated

Once the permissions boundary is updated, all labs should work correctly:
- Lab 1: S3 Security
- Lab 2: IAM Privilege Escalation
- Lab 3: EC2 Security
- Lab 4: Lambda Security
- Lab 5: DynamoDB Security
- Lab 6: CloudTrail Investigation
- Lab 7: SSM Exploitation

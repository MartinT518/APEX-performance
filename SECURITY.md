# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **DO NOT** open a public issue. Instead, please email the maintainers directly or use GitHub's private security advisory feature.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### Response Time

We aim to respond to security reports within 48 hours and provide a fix within 7 days for critical issues.

## Security Best Practices

### For Users

1. **Never commit `.env.local` files** - These contain sensitive credentials
2. **Use strong passwords** - Minimum 12 characters, mix of letters, numbers, symbols
3. **Enable 2FA** - If available in your Supabase project
4. **Rotate API keys regularly** - Especially if exposed or compromised
5. **Review access logs** - Monitor for unauthorized access

### For Developers

1. **Environment Variables** - Always use environment variables for secrets
2. **Never log credentials** - Remove credential logging in error handlers
3. **Validate inputs** - Always validate and sanitize user inputs
4. **Use parameterized queries** - Never construct SQL queries from user input
5. **Keep dependencies updated** - Run `npm audit` regularly

## Known Security Considerations

### Supabase Row Level Security (RLS)

All database tables have RLS enabled. Users can only access their own data. This is enforced at the database level.

### Authentication

- Uses Supabase Auth for authentication
- Sessions are managed by Supabase
- Passwords are hashed by Supabase (bcrypt)

### API Keys

- **Publishable Key**: Safe for client-side use (exposed in browser)
- **Secret Key**: **NEVER** expose to client-side code
- **Service Role Key**: Only use in server-side code

### Garmin Credentials

- Stored in environment variables only
- Never logged or exposed in error messages
- Optional - app works without Garmin integration

## Security Updates

Security updates will be released as patch versions (e.g., 0.1.1, 0.1.2). Critical security fixes may be released as hotfixes.

## Dependency Security

We regularly audit dependencies using `npm audit`. As of 2025-01-27, **0 vulnerabilities** were found.

To check for vulnerabilities:
```bash
npm audit
```

To fix automatically fixable issues:
```bash
npm audit fix
```

## Compliance

This application:
- Does not collect personal data beyond what's necessary for functionality
- Uses Supabase for data storage (GDPR-compliant infrastructure)
- Implements proper authentication and authorization
- Follows OWASP security best practices

For GDPR compliance, ensure:
- Users can export their data
- Users can delete their accounts
- Privacy policy is displayed
- Data retention policies are documented

## Security Checklist for Deployment

Before deploying to production:

- [ ] All environment variables are set correctly
- [ ] `.env.local` is not committed to repository
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] Security headers are configured in `next.config.ts`
- [ ] Error messages don't expose sensitive information
- [ ] Authentication is properly configured
- [ ] RLS policies are enabled in Supabase
- [ ] Backup procedures are documented
- [ ] Monitoring and alerting are set up
- [ ] Rate limiting is configured (if applicable)

## Contact

For security concerns, please contact the repository maintainers through GitHub's security advisory feature.


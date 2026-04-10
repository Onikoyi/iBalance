import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PublicShell } from '../components/layout/PublicShell';
import {
  createTenantSubscriptionApplication,
  getPublicBillingSettings,
  getPublicSubscriptionPackages,
  getTenantReadableError,
  type SubscriptionApplicationCreateResponse,
} from '../lib/api';
import { PasswordInput } from '../components/common/PasswordInput';

function formatMoney(amount: number, currencyCode: string) {
  if (amount <= 0) return 'Contact Sales';

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode || 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SubscriptionRequestPage() {
  const [searchParams] = useSearchParams();
  const initialPackageId = searchParams.get('packageId') || '';

  const [companyName, setCompanyName] = useState('');
  const [desiredTenantKey, setDesiredTenantKey] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [packageId, setPackageId] = useState(initialPackageId);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [successData, setSuccessData] = useState<SubscriptionApplicationCreateResponse | null>(null);

  const packagesQ = useQuery({
    queryKey: ['public-subscription-packages'],
    queryFn: getPublicSubscriptionPackages,
  });

  const billingQ = useQuery({
    queryKey: ['public-billing-settings'],
    queryFn: getPublicBillingSettings,
  });

  const selectedPackage = useMemo(
    () => (packagesQ.data?.items || []).find((x) => x.id === packageId) || null,
    [packagesQ.data?.items, packageId]
  );

  const submitMut = useMutation({
    mutationFn: createTenantSubscriptionApplication,
    onSuccess: (data) => {
      setSuccessData(data);
      setMessage('');
      setCompanyName('');
      setDesiredTenantKey('');
      setAdminFirstName('');
      setAdminLastName('');
      setAdminEmail('');
      setPassword('');
      setConfirmPassword('');
      setPackageId(initialPackageId);
    },
    onError: (e) => {
      setSuccessData(null);
      setMessage(getTenantReadableError(e, 'We could not complete your subscription request at this time.'));
    },
  });

  function submit() {
    setMessage('');
    setSuccessData(null);

    if (!companyName.trim()) {
      setMessage('Please enter your organization name.');
      return;
    }

    if (!desiredTenantKey.trim()) {
      setMessage('Please choose a tenant key.');
      return;
    }

    if (!adminFirstName.trim()) {
      setMessage('Please enter the administrator’s first name.');
      return;
    }

    if (!adminLastName.trim()) {
      setMessage('Please enter the administrator’s last name.');
      return;
    }

    if (!adminEmail.trim()) {
      setMessage('Please enter the administrator’s email address.');
      return;
    }

    if (!packageId) {
      setMessage('Please select a subscription plan.');
      return;
    }

    if (!password.trim() || password.length < 8) {
      setMessage('Your password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('The passwords entered do not match.');
      return;
    }

    submitMut.mutate({
      companyName: companyName.trim(),
      desiredTenantKey: desiredTenantKey.trim(),
      adminFirstName: adminFirstName.trim(),
      adminLastName: adminLastName.trim(),
      adminEmail: adminEmail.trim(),
      password,
      subscriptionPackageId: packageId,
    });
  }

  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Subscription setup</div>
          <h1 className="hero-title">Create your organization subscription</h1>
          <p className="hero-subtitle">
            Choose a plan, reserve your tenant key, and create your first administrator account.
            Once payment is confirmed, your organization will be ready for access.
          </p>

          <div className="hero-actions">
            <Link to="/pricing" className="button">Back to Pricing</Link>
            <Link to="/login" className="button">Sign In</Link>
          </div>
        </section>

        {message ? (
          <section className="panel">
            <div className="muted">{message}</div>
          </section>
        ) : null}

        {successData ? (
          <section className="panel">
            <div className="section-heading">
              <h2>Subscription request received</h2>
              <span className="muted">Complete payment using the details below</span>
            </div>

            <div className="kv">
              <div className="kv-row"><span>Organization</span><span>{successData.companyName}</span></div>
              <div className="kv-row"><span>Tenant Key</span><span>{successData.desiredTenantKey}</span></div>
              <div className="kv-row"><span>Administrator Email</span><span>{successData.adminEmail}</span></div>
              <div className="kv-row"><span>Selected Plan</span><span>{successData.packageNameSnapshot}</span></div>
              <div className="kv-row"><span>Annual Subscription</span><span>{formatMoney(successData.amountSnapshot, successData.currencyCodeSnapshot)} / year</span></div>
              <div className="kv-row"><span>Payment Reference</span><span><strong>{successData.paymentReference}</strong></span></div>
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <div className="section-heading">
                <h2>Payment details</h2>
                <span className="muted">Use the payment reference exactly as shown above</span>
              </div>

              <div className="kv">
                <div className="kv-row"><span>Account Name</span><span>{successData.billing.accountName || 'To be provided'}</span></div>
                <div className="kv-row"><span>Bank Name</span><span>{successData.billing.bankName || 'To be provided'}</span></div>
                <div className="kv-row"><span>Account Number</span><span>{successData.billing.accountNumber || 'To be provided'}</span></div>
                <div className="kv-row"><span>Support Email</span><span>{successData.billing.supportEmail || 'To be provided'}</span></div>
              </div>

              <div className="muted" style={{ marginTop: 12 }}>
                {successData.billing.paymentInstructions || 'Payment instructions will be shared by the support team.'}
              </div>
            </div>

            <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <Link to="/pricing" className="button">Back to Pricing</Link>
              <button className="button primary" onClick={() => setSuccessData(null)}>
                Submit Another Request
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>Organization details</h2>
                <span className="muted">Enter the information required to create your subscription request</span>
              </div>

              <div className="form-grid two">
                <div className="form-row">
                  <label>Organization Name</label>
                  <input
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter your organization name"
                  />
                </div>

                <div className="form-row">
                  <label>Tenant Key</label>
                  <input
                    className="input"
                    value={desiredTenantKey}
                    onChange={(e) => setDesiredTenantKey(e.target.value)}
                    placeholder="Choose a unique tenant key"
                  />
                </div>

                <div className="form-row">
                  <label>Administrator First Name</label>
                  <input
                    className="input"
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>

                <div className="form-row">
                  <label>Administrator Last Name</label>
                  <input
                    className="input"
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>

                <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                  <label>Administrator Email</label>
                  <input
                    className="input"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                  <label>Subscription Plan</label>
                  <select className="select" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                    <option value="">— Select a Plan —</option>
                    {(packagesQ.data?.items || []).map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({formatMoney(pkg.monthlyPrice, pkg.currencyCode)} / year)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label>Password</label>
                  <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
                </div>

                <div className="form-row">
                  <label>Confirm Password</label>
                  <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                </div>
              </div>

              {selectedPackage ? (
                <div className="kv" style={{ marginTop: 16 }}>
                  <div className="kv-row"><span>Selected Plan</span><span>{selectedPackage.name}</span></div>
                  <div className="kv-row"><span>Annual Subscription</span><span>{formatMoney(selectedPackage.monthlyPrice, selectedPackage.currencyCode)} / year</span></div>
                </div>
              ) : null}

              <div className="inline-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="button primary" onClick={submit} disabled={submitMut.isPending}>
                  {submitMut.isPending ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Payment information</h2>
                <span className="muted">Payment details for subscription activation</span>
              </div>

              {billingQ.isLoading ? (
                <div className="panel">Loading payment information...</div>
              ) : (
                <div className="kv">
                  <div className="kv-row"><span>Account Name</span><span>{billingQ.data?.accountName || 'To be provided'}</span></div>
                  <div className="kv-row"><span>Bank Name</span><span>{billingQ.data?.bankName || 'To be provided'}</span></div>
                  <div className="kv-row"><span>Account Number</span><span>{billingQ.data?.accountNumber || 'To be provided'}</span></div>
                  <div className="kv-row"><span>Support Email</span><span>{billingQ.data?.supportEmail || 'To be provided'}</span></div>
                  <div className="muted" style={{ marginTop: 10 }}>
                    {billingQ.data?.paymentInstructions || 'Payment guidance will be provided by the support team.'}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PublicShell>
  );
}
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { BadgeCheck, CreditCard, ExternalLink, Receipt } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@taskforge/shared-utils';
import { get, post, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, Switch } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  tier: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  maxMembers: number;
  maxProjects: number;
  features: string[];
}

interface Subscription {
  status: string;
  interval: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  plan: Plan;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amountDueCents: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  issuedAt: string;
}

export default function BillingSettingsPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [yearly, setYearly] = useState(false);

  const { data: plans, isPending: plansPending } = useQuery({
    queryKey: ['plans'],
    queryFn: () => get<Plan[]>('/billing/plans'),
  });
  const { data: subscription } = useQuery({
    queryKey: ['subscription', workspaceId],
    queryFn: () => get<Subscription | null>(`/workspaces/${workspaceId}/billing/subscription`),
  });
  const { data: invoices } = useQuery({
    queryKey: ['invoices', workspaceId],
    queryFn: () => get<Invoice[]>(`/workspaces/${workspaceId}/billing/invoices`),
  });

  const checkout = useMutation({
    mutationFn: (input: { planTier: string; interval: string }) =>
      post<{ url: string | null }>(`/workspaces/${workspaceId}/billing/checkout`, input),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const portal = useMutation({
    mutationFn: () => post<{ url: string }>(`/workspaces/${workspaceId}/billing/portal`),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const currentTier = subscription?.plan.tier ?? 'FREE';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" /> Current plan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <p className="text-lg font-semibold">
              {subscription?.plan.name ?? 'Free'}{' '}
              <Badge variant={subscription?.status === 'PAST_DUE' ? 'destructive' : 'success'} className="ml-1 align-middle">
                {subscription?.status ?? 'ACTIVE'}
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription?.currentPeriodEnd
                ? subscription.cancelAtPeriodEnd
                  ? `Cancels on ${format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}`
                  : `Renews on ${format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}`
                : 'No billing period — free plan'}
            </p>
          </div>
          {currentTier !== 'FREE' && (
            <Button variant="outline" onClick={() => portal.mutate()} loading={portal.isPending}>
              Manage payment <ExternalLink />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plan picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Plans</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Monthly
          <Switch checked={yearly} onCheckedChange={setYearly} />
          Yearly <Badge variant="success">2 months free</Badge>
        </label>
      </div>

      {plansPending ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans?.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const price = yearly ? plan.priceYearlyCents / 12 : plan.priceMonthlyCents;
            return (
              <Card key={plan.id} className={cn(isCurrent && 'border-primary ring-1 ring-primary')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {plan.name}
                    {isCurrent && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    <span className="text-2xl font-bold">{formatMoney(Math.round(price))}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  {plan.tier === 'FREE' ? (
                    <Button variant="outline" className="w-full" disabled>
                      {isCurrent ? 'Current plan' : 'Free tier'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent}
                      loading={checkout.isPending}
                      onClick={() =>
                        checkout.mutate({ planTier: plan.tier, interval: yearly ? 'YEARLY' : 'MONTHLY' })
                      }
                    >
                      {isCurrent ? 'Current plan' : 'Upgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices?.length ? (
            <div className="divide-y text-sm">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-3 py-2.5">
                  <span className="font-mono text-xs">{invoice.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(invoice.issuedAt), 'MMM d, yyyy')}
                  </span>
                  <Badge variant={invoice.status === 'PAID' ? 'success' : 'warning'} className="ml-auto">
                    {invoice.status}
                  </Badge>
                  <span className="w-20 text-right font-medium">
                    {formatMoney(invoice.amountDueCents, invoice.currency)}
                  </span>
                  {invoice.hostedInvoiceUrl && (
                    <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

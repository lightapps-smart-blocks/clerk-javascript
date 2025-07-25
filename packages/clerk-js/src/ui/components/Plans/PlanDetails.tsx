import { useClerk, useOrganization } from '@clerk/shared/react';
import type {
  __internal_PlanDetailsProps,
  ClerkAPIError,
  ClerkRuntimeError,
  CommercePlanResource,
  CommerceSubscriptionPlanPeriod,
  CommerceSubscriptionResource,
} from '@clerk/types';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { Alert } from '@/ui/elements/Alert';
import { Avatar } from '@/ui/elements/Avatar';
import { Drawer, useDrawerContext } from '@/ui/elements/Drawer';
import { Switch } from '@/ui/elements/Switch';
import { handleError } from '@/ui/utils/errorHandler';

import { useProtect } from '../../common';
import { SubscriberTypeContext, usePlansContext, useSubscriberTypeContext, useSubscriptions } from '../../contexts';
import { Badge, Box, Button, Col, descriptors, Flex, Heading, localizationKeys, Span, Text } from '../../customizables';

export const PlanDetails = (props: __internal_PlanDetailsProps) => {
  return (
    <SubscriberTypeContext.Provider value={props.subscriberType || 'user'}>
      <Drawer.Content>
        <PlanDetailsInternal {...props} />
      </Drawer.Content>
    </SubscriberTypeContext.Provider>
  );
};

const PlanDetailsInternal = ({
  plan,
  onSubscriptionCancel,
  portalRoot,
  initialPlanPeriod = 'month',
}: __internal_PlanDetailsProps) => {
  const clerk = useClerk();
  const { organization } = useOrganization();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<ClerkRuntimeError | ClerkAPIError | string | undefined>();
  const [planPeriod, setPlanPeriod] = useState<CommerceSubscriptionPlanPeriod>(initialPlanPeriod);

  const { setIsOpen } = useDrawerContext();
  const {
    activeOrUpcomingSubscriptionBasedOnPlanPeriod,
    revalidateAll,
    buttonPropsForPlan,
    isDefaultPlanImplicitlyActiveOrUpcoming,
  } = usePlansContext();
  const subscriberType = useSubscriberTypeContext();
  const canManageBilling = useProtect(
    has => has({ permission: 'org:sys_billing:manage' }) || subscriberType === 'user',
  );

  if (!plan) {
    return null;
  }

  const subscription = activeOrUpcomingSubscriptionBasedOnPlanPeriod(plan, planPeriod);

  const handleClose = () => {
    if (setIsOpen) {
      setIsOpen(false);
    }
  };

  const features = plan.features;
  const hasFeatures = features.length > 0;
  const cancelSubscription = async () => {
    if (!subscription) {
      return;
    }

    setCancelError(undefined);
    setIsSubmitting(true);

    await subscription
      .cancel({ orgId: subscriberType === 'org' ? organization?.id : undefined })
      .then(() => {
        setIsSubmitting(false);
        onSubscriptionCancel?.();
        handleClose();
      })
      .catch(error => {
        handleError(error, [], setCancelError);
        setIsSubmitting(false);
      });
  };

  type Open__internal_CheckoutProps = {
    planPeriod?: CommerceSubscriptionPlanPeriod;
  };

  const openCheckout = (props?: Open__internal_CheckoutProps) => {
    handleClose();

    // if the plan doesn't support annual, use monthly
    let _planPeriod = props?.planPeriod || planPeriod;
    if (_planPeriod === 'annual' && plan.annualMonthlyAmount === 0) {
      _planPeriod = 'month';
    }

    clerk.__internal_openCheckout({
      planId: plan.id,
      planPeriod: _planPeriod,
      subscriberType: subscriberType,
      onSubscriptionComplete: () => {
        void revalidateAll();
      },
      portalRoot,
    });
  };

  return (
    <>
      <Drawer.Header
        sx={t =>
          !hasFeatures
            ? {
                flex: 1,
                borderBottomWidth: 0,
                background: t.colors.$colorBackground,
              }
            : null
        }
      >
        <Header
          plan={plan}
          subscription={subscription}
          planPeriod={planPeriod}
          setPlanPeriod={setPlanPeriod}
          closeSlot={<Drawer.Close />}
        />
      </Drawer.Header>

      {hasFeatures ? (
        <Drawer.Body>
          <Text
            elementDescriptor={descriptors.planDetailCaption}
            variant={'caption'}
            localizationKey={localizationKeys('commerce.availableFeatures')}
            colorScheme='secondary'
            sx={t => ({
              padding: t.space.$4,
              paddingBottom: 0,
            })}
          />
          <Box
            elementDescriptor={descriptors.planDetailFeaturesList}
            as='ul'
            role='list'
            sx={t => ({
              display: 'grid',
              rowGap: t.space.$6,
              padding: t.space.$4,
              margin: 0,
            })}
          >
            {features.map(feature => (
              <Box
                key={feature.id}
                elementDescriptor={descriptors.planDetailFeaturesListItem}
                as='li'
                sx={t => ({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: t.space.$3,
                })}
              >
                {feature.avatarUrl ? (
                  <Avatar
                    size={_ => 24}
                    title={feature.name}
                    initials={feature.name[0]}
                    rounded={false}
                    imageUrl={feature.avatarUrl}
                  />
                ) : null}
                <Span elementDescriptor={descriptors.planDetailFeaturesListItemContent}>
                  <Text
                    elementDescriptor={descriptors.planDetailFeaturesListItemTitle}
                    colorScheme='body'
                    sx={t => ({
                      fontWeight: t.fontWeights.$medium,
                    })}
                  >
                    {feature.name}
                  </Text>
                  {feature.description ? (
                    <Text
                      elementDescriptor={descriptors.planDetailFeaturesListItemDescription}
                      colorScheme='secondary'
                      sx={t => ({
                        marginBlockStart: t.space.$0x25,
                      })}
                    >
                      {feature.description}
                    </Text>
                  ) : null}
                </Span>
              </Box>
            ))}
          </Box>
        </Drawer.Body>
      ) : null}

      {(!plan.isDefault && !isDefaultPlanImplicitlyActiveOrUpcoming) || !subscription ? (
        <Drawer.Footer>
          {subscription ? (
            subscription.canceledAtDate ? (
              <Button
                block
                textVariant='buttonLarge'
                {...buttonPropsForPlan({ plan })}
                onClick={() => openCheckout()}
              />
            ) : (
              <Col gap={4}>
                {!!subscription &&
                subscription.planPeriod === 'month' &&
                plan.annualMonthlyAmount > 0 &&
                planPeriod === 'annual' ? (
                  <Button
                    block
                    variant='bordered'
                    colorScheme='secondary'
                    textVariant='buttonLarge'
                    isDisabled={!canManageBilling}
                    onClick={() => openCheckout({ planPeriod: 'annual' })}
                    localizationKey={localizationKeys('commerce.switchToAnnual')}
                  />
                ) : null}
                {!!subscription && subscription.planPeriod === 'annual' && planPeriod === 'month' ? (
                  <Button
                    block
                    variant='bordered'
                    colorScheme='secondary'
                    textVariant='buttonLarge'
                    isDisabled={!canManageBilling}
                    onClick={() => openCheckout({ planPeriod: 'month' })}
                    localizationKey={localizationKeys('commerce.switchToMonthly')}
                  />
                ) : null}
                <Button
                  block
                  variant='bordered'
                  colorScheme='danger'
                  textVariant='buttonLarge'
                  isDisabled={!canManageBilling}
                  onClick={() => setShowConfirmation(true)}
                  localizationKey={localizationKeys('commerce.cancelSubscription')}
                />
              </Col>
            )
          ) : (
            <Button
              block
              textVariant='buttonLarge'
              {...buttonPropsForPlan({ plan })}
              onClick={() => openCheckout()}
            />
          )}
        </Drawer.Footer>
      ) : null}

      {subscription ? (
        <Drawer.Confirmation
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          actionsSlot={
            <>
              {!isSubmitting && (
                <Button
                  variant='ghost'
                  size='sm'
                  textVariant='buttonLarge'
                  isDisabled={!canManageBilling}
                  onClick={() => {
                    setCancelError(undefined);
                    setShowConfirmation(false);
                  }}
                  localizationKey={localizationKeys('commerce.keepSubscription')}
                />
              )}
              <Button
                variant='solid'
                colorScheme='danger'
                size='sm'
                textVariant='buttonLarge'
                isLoading={isSubmitting}
                isDisabled={!canManageBilling}
                onClick={() => {
                  setCancelError(undefined);
                  setShowConfirmation(false);
                  void cancelSubscription();
                }}
                localizationKey={localizationKeys('commerce.cancelSubscription')}
              />
            </>
          }
        >
          <Heading
            elementDescriptor={descriptors.drawerConfirmationTitle}
            as='h2'
            textVariant='h3'
            localizationKey={localizationKeys('commerce.cancelSubscriptionTitle', {
              plan: `${subscription.status === 'upcoming' ? 'upcoming ' : ''}${subscription.plan.name}`,
            })}
          />
          <Text
            elementDescriptor={descriptors.drawerConfirmationDescription}
            colorScheme='secondary'
            localizationKey={
              subscription.status === 'upcoming'
                ? localizationKeys('commerce.cancelSubscriptionNoCharge')
                : localizationKeys('commerce.cancelSubscriptionAccessUntil', {
                    plan: subscription.plan.name,
                    // @ts-expect-error this will always be defined in this case.
                    date: subscription.periodEndDate,
                  })
            }
          />
          {cancelError && (
            <Alert colorScheme='danger'>{typeof cancelError === 'string' ? cancelError : cancelError.message}</Alert>
          )}
        </Drawer.Confirmation>
      ) : null}
    </>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Header
 * -----------------------------------------------------------------------------------------------*/

interface HeaderProps {
  plan: CommercePlanResource;
  subscription?: CommerceSubscriptionResource;
  planPeriod: CommerceSubscriptionPlanPeriod;
  setPlanPeriod: (val: CommerceSubscriptionPlanPeriod) => void;
  closeSlot?: React.ReactNode;
}

const Header = React.forwardRef<HTMLDivElement, HeaderProps>((props, ref) => {
  const { plan, subscription, closeSlot, planPeriod, setPlanPeriod } = props;

  const { captionForSubscription, isDefaultPlanImplicitlyActiveOrUpcoming } = usePlansContext();
  const { data: subscriptions } = useSubscriptions();

  const isImplicitlyActiveOrUpcoming = isDefaultPlanImplicitlyActiveOrUpcoming && plan.isDefault;

  const showBadge = !!subscription;

  const getPlanFee = useMemo(() => {
    if (plan.annualMonthlyAmount <= 0) {
      return plan.amountFormatted;
    }
    return planPeriod === 'annual' ? plan.annualMonthlyAmountFormatted : plan.amountFormatted;
  }, [plan, planPeriod]);

  return (
    <Box
      ref={ref}
      elementDescriptor={descriptors.planDetailHeader}
      sx={t => ({
        width: '100%',
        padding: t.space.$4,
        position: 'relative',
      })}
    >
      {closeSlot ? (
        <Box
          sx={t => ({
            position: 'absolute',
            top: t.space.$2,
            insetInlineEnd: t.space.$2,
          })}
        >
          {closeSlot}
        </Box>
      ) : null}

      <Col
        gap={3}
        elementDescriptor={descriptors.planDetailBadgeAvatarTitleDescriptionContainer}
      >
        {showBadge ? (
          <Flex
            align='center'
            gap={3}
            elementDescriptor={descriptors.planDetailBadgeContainer}
            sx={t => ({
              paddingInlineEnd: t.space.$10,
            })}
          >
            {subscription?.status === 'active' || (isImplicitlyActiveOrUpcoming && subscriptions.length === 0) ? (
              <Badge
                elementDescriptor={descriptors.planDetailBadge}
                localizationKey={localizationKeys('badge__activePlan')}
                colorScheme={'secondary'}
              />
            ) : (
              <Badge
                elementDescriptor={descriptors.planDetailBadge}
                localizationKey={localizationKeys('badge__upcomingPlan')}
                colorScheme={'primary'}
              />
            )}
            {!!subscription && (
              <Text
                elementDescriptor={descriptors.planDetailCaption}
                variant={'caption'}
                localizationKey={captionForSubscription(subscription)}
                colorScheme='secondary'
              />
            )}
          </Flex>
        ) : null}
        {plan.avatarUrl ? (
          <Avatar
            boxElementDescriptor={descriptors.planDetailAvatar}
            size={_ => 40}
            title={plan.name}
            initials={plan.name[0]}
            rounded={false}
            imageUrl={plan.avatarUrl}
            sx={t => ({
              marginBlockEnd: t.space.$3,
            })}
          />
        ) : null}
        <Col
          gap={1}
          elementDescriptor={descriptors.planDetailTitleDescriptionContainer}
        >
          <Heading
            elementDescriptor={descriptors.planDetailTitle}
            as='h2'
            textVariant='h2'
          >
            {plan.name}
          </Heading>
          {plan.description ? (
            <Text
              elementDescriptor={descriptors.planDetailDescription}
              variant='subtitle'
              colorScheme='secondary'
            >
              {plan.description}
            </Text>
          ) : null}
        </Col>
      </Col>

      <Flex
        elementDescriptor={descriptors.planDetailFeeContainer}
        align='center'
        wrap='wrap'
        sx={t => ({
          marginTop: t.space.$3,
          columnGap: t.space.$1x5,
        })}
      >
        <>
          <Text
            elementDescriptor={descriptors.planDetailFee}
            variant='h1'
            colorScheme='body'
          >
            {plan.currencySymbol}
            {getPlanFee}
          </Text>
          <Text
            elementDescriptor={descriptors.planDetailFeePeriod}
            variant='caption'
            colorScheme='secondary'
            sx={t => ({
              textTransform: 'lowercase',
              ':before': {
                content: '"/"',
                marginInlineEnd: t.space.$1,
              },
            })}
            localizationKey={localizationKeys('commerce.month')}
          />
        </>
      </Flex>

      {plan.annualMonthlyAmount > 0 ? (
        <Box
          elementDescriptor={descriptors.planDetailPeriodToggle}
          sx={t => ({
            display: 'flex',
            marginTop: t.space.$3,
          })}
        >
          <Switch
            isChecked={planPeriod === 'annual'}
            onChange={(checked: boolean) => setPlanPeriod(checked ? 'annual' : 'month')}
            label={localizationKeys('commerce.billedAnnually')}
          />
        </Box>
      ) : (
        <Text
          elementDescriptor={descriptors.pricingTableCardFeePeriodNotice}
          variant='caption'
          colorScheme='secondary'
          localizationKey={
            plan.isDefault ? localizationKeys('commerce.alwaysFree') : localizationKeys('commerce.billedMonthlyOnly')
          }
          sx={t => ({
            justifySelf: 'flex-start',
            alignSelf: 'center',
            marginTop: t.space.$3,
          })}
        />
      )}
    </Box>
  );
});

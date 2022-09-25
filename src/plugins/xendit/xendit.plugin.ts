import {
	LanguageCode,
	PluginCommonModule,
	Type,
	VendurePlugin,
} from '@vendure/core';
import { gql } from 'graphql-tag';

import { XENDIT_PLUGIN_OPTIONS } from './constant';
import { XenditController } from './xendit.controller';
import { xenditPaymentMethodHandler } from './xendit.handler';
import { XenditResolver } from './xendit.resolver';
import { XenditService } from './xendit.service';
import { XenditPluginOptions } from './types';
import { HttpModule } from '@nestjs/axios';

/**
 * @description
 * Plugin to enable payments through [Xendit](https://xendit.com/docs) via the Payment Intents API.
 *
 * ## Requirements
 *
 * 1. You will need to create a Xendit account and get your secret key in the dashboard.
 * 2. Create a webhook endpoint in the Xendit dashboard (Developers -> Webhooks, "Add an endpoint") which listens to the `payment_intent.succeeded`
 * and `payment_intent.payment_failed` events. The URL should be `https://my-shop.comXendit/xendit`, where
 * `my-shop.com` is the host of your storefront application. *Note:* for local development, you'll need to use
 * the Xendit CLI to test your webhook locally. See the _local development_ section below.
 * 3. Get the signing secret for the newly created webhook.
 * 4. Install the Payments plugin and the Xendit Node library:
 *
 *     `yarn add \@vendure/payments-plugin xendit`
 *
 *     or
 *
 *     `npm install \@vendure/payments-plugin xendit`
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig `plugins` array:
 *     ```TypeScript
 *     import { XenditPlugin } from '\@vendure/payments-plugin/package/xendit';
 *
 *     // ...
 *
 *     plugins: [
 *       XenditPlugin.init({
 *         apiKey: process.env.YOUR_STRIPE_SECRET_KEY,
 *         webhookSigningSecret: process.env.YOUR_STRIPE_WEBHOOK_SIGNING_SECRET,
 *         // This prevents different customers from using the same PaymentIntent
 *         storeCustomersInXendit: true,
 *       }),
 *     ]
 *     ````
 * 2. Create a new PaymentMethod in the Admin UI, and select "Xendit payments" as the handler.
 *
 * ## Storefront usage
 *
 * The plugin is designed to work with the [Custom payment flow](https://xendit.com/docs/payments/accept-a-payment?platform=web&ui=elements).
 * In this flow, Xendit provides libraries which handle the payment UI and confirmation for you. You can install it in your storefront project
 * with:
 *
 * ```shell
 * yarn add \@xendit/xendit-js
 * # or
 * npm install \@xendit/xendit-js
 * ```
 *
 * If you are using React, you should also consider installing `@xendit/react-xendit-js`, which is a wrapper around Xendit Elements.
 *
 * The high-level workflow is:
 * 1. Create a "payment intent" on the server by executing the `createXenditPaymentIntent` mutation which is exposed by this plugin.
 * 2. Use the returned client secret to instantiate the Xendit Payment Element:
 *    ```TypeScript
 *    import { Elements } from '\@xendit/react-xendit-js';
 *    import { loadXendit, Xendit } from '\@xendit/xendit-js';
 *    import { CheckoutForm } from './CheckoutForm';
 *
 *    const xenditPromise = getXendit('pk_test_....wr83u');
 *
 *    type XenditPaymentsProps = {
 *      clientSecret: string;
 *      orderCode: string;
 *    }
 *
 *    export function XenditPayments({ clientSecret, orderCode }: XenditPaymentsProps) {
 *      const options = {
 *        // passing the client secret obtained from the server
 *        clientSecret,
 *      }
 *      return (
 *        <Elements xendit={xenditPromise} options={options}>
 *          <CheckoutForm orderCode={orderCode} />
 *        </Elements>
 *      );
 *    }
 *    ```
 *    ```TypeScript
 *    // CheckoutForm.tsx
 *    import { useXendit, useElements, PaymentElement } from '@xendit/react-xendit-js';
 *    import { FormEvent } from 'react';
 *
 *    export const CheckoutForm = ({ orderCode }: { orderCode: string }) => {
 *      const xendit = useXendit();
 *      const elements = useElements();
 *
 *      const handleSubmit = async (event: FormEvent) => {
 *        // We don't want to let default form submission happen here,
 *        // which would refresh the page.
 *        event.preventDefault();
 *
 *        if (!xendit || !elements) {
 *          // Xendit.js has not yet loaded.
 *          // Make sure to disable form submission until Xendit.js has loaded.
 *          return;
 *        }
 *
 *        const result = await xendit.confirmPayment({
 *          //`Elements` instance that was used to create the Payment Element
 *          elements,
 *          confirmParams: {
 *            return_url: location.origin + `/checkout/confirmation/${orderCode}`,
 *          },
 *        });
 *
 *        if (result.error) {
 *          // Show error to your customer (for example, payment details incomplete)
 *          console.log(result.error.message);
 *        } else {
 *          // Your customer will be redirected to your `return_url`. For some payment
 *          // methods like iDEAL, your customer will be redirected to an intermediate
 *          // site first to authorize the payment, then redirected to the `return_url`.
 *        }
 *      };
 *
 *      return (
 *        <form onSubmit={handleSubmit}>
 *          <PaymentElement />
 *          <button disabled={!xendit}>Submit</button>
 *        </form>
 *      );
 *    };
 *    ```
 * 3. Once the form is submitted and Xendit processes the payment, the webhook takes care of updating the order without additional action
 * in the storefront. As in the code above, the customer will be redirected to `/checkout/confirmation/${orderCode}`.
 *
 * {{% alert "primary" %}}
 * A full working storefront example of the Xendit integration can be found in the
 * [Remix Starter repo](https://github.com/vendure-ecommerce/storefront-remix-starter/tree/master/app/components/checkout/xendit)
 * {{% /alert %}}
 *
 * ## Local development
 *
 * 1. Download & install the Xendit CLI: https://xendit.com/docs/xendit-cli
 * 2. From your Xendit dashboard, go to Developers -> Webhooks and click "Add an endpoint" and follow the instructions
 * under "Test in a local environment".
 * 3. The Xendit CLI command will look like
 *    ```shell
 *    xendit listen --forward-to localhost:3000/payments/xendit
 *    ```
 * 4. The Xendit CLI will create a webhook signing secret you can then use in your config of the XenditPlugin.
 *
 * @docsCategory payments-plugin
 * @docsPage XenditPlugin
 */
@VendurePlugin({
	imports: [
		HttpModule.register({
			baseURL: 'https://api.xendit.co',
		}),
		PluginCommonModule,
	],
	controllers: [XenditController],
	providers: [
		{
			provide: XENDIT_PLUGIN_OPTIONS,
			useFactory: (): XenditPluginOptions => XenditPlugin.options,
		},
		XenditService,
	],
	configuration: (config) => {
		config.paymentOptions.paymentMethodHandlers.push(
			xenditPaymentMethodHandler,
		);

		return config;
	},
	shopApiExtensions: {
		schema: gql`
			scalar Date

			type XenditCreatePaymentResponse {
				id: String!
				user_id: String!
				external_id: String!
				status: String!
				merchant_name: String!
				merchant_profile_picture_url: String!
				amount: Int!
				payer_email: String!
				description: String!
				invoice_url: String!
				expiry_date: Date!
				currency: String!
				created: Date!
				updated: Date!
			}
			extend type Mutation {
				createXenditPayment: XenditCreatePaymentResponse
			}
		`,
		resolvers: [XenditResolver],
	},
})
export class XenditPlugin {
	static options: XenditPluginOptions;

	/**
	 * @description
	 * Initialize the Xendit payment plugin
	 */
	static init(options: XenditPluginOptions): Type<XenditPlugin> {
		this.options = options;
		return XenditPlugin;
	}
}

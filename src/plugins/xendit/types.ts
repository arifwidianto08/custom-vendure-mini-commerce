import '@vendure/core/dist/entity/custom-entity-fields';
import { Request } from 'express';

// Note: deep import is necessary here because CustomCustomerFields is also extended in the Braintree
// plugin. Reference: https://github.com/microsoft/TypeScript/issues/46617
declare module '@vendure/core/dist/entity/custom-entity-fields' {
	interface CustomCustomerFields {
		xenditCustomerId?: string;
	}
}

/**
 * @description
 * Configuration options for the Xendit payments plugin.
 *
 * @docsCategory payments-plugin
 * @docsPage XenditPlugin
 */
export interface XenditPluginOptions {
	/**
	 * @description
	 * Secret key of your Xendit account.
	 */
	apiKey: string;
	/**
	 * @description
	 * Token of your configured Xendit callback.
	 */
	callbackToken?: string;
	/**
	 * @description
	 * Duration of time that the end customer is given to pay the invoice before expiration (in seconds, since creation). Default is 24 hours (86,400 seconds).
	 *
	 * Min number: 1 second
	 *
	 * Max number: 31536000 seconds (1 year)
	 *
	 * https://developers.xendit.co/api-reference/#create-invoice
	 */
	invoiceDuration?: number;
	/**
	 * @description
	 * Specify the payment channels that you wish to be available on your Invoice / Checkout UI.
	 *
	 * Leave this field empty if you would like all payment channels to be available on this particular invoice, or if you want to use the defaults set in your Xendit Dashboard Settings.
	 *
	 * https://developers.xendit.co/api-reference/#create-invoice
	 */
	paymentMethods?: string[];
}

export interface RequestWithRawBody extends Request {
	rawBody: Buffer;
}

export interface AvailableBank {
	bank_code: string;
	collection_type: string;
	transfer_amount: number;
	bank_branch: string;
	account_holder_name: string;
}

export interface AvailableRetailOutlet {
	retail_outlet_name: string;
}

export interface AvailablePayLater {
	paylater_type: string;
}

export interface Address {
	city: string;
	country: string;
	postal_code: string;
	state: string;
	street_line1: string;
	street_line2: string;
}

export interface Customer {
	addresses: Address[];
	email: string;
	given_names: string;
	mobile_number: string;
	surname: string;
}

export interface Item {
	name: string;
	quantity: number;
	price: number;
	category: string;
	url: string;
}

export interface Fee {
	type: string;
	value: number;
}

export interface XenditCreateInvoiceResponse {
	id: string;
	user_id: string;
	external_id: string;
	status: string;
	merchant_name: string;
	merchant_profile_picture_url: string;
	amount: number;
	payer_email: string;
	description: string;
	invoice_url: string;
	expiry_date: Date;
	available_banks: AvailableBank[];
	available_retail_outlets: AvailableRetailOutlet[];
	available_paylaters: AvailablePayLater[];
	should_exclude_credit_card: boolean;
	should_send_email: boolean;
	created: Date;
	updated: Date;
	mid_label: string;
	currency: string;
	fixed_va: boolean;
	locale: string;
	customer: Customer;
	items: Item[];
	fees: Fee[];
}

export interface XenditCallbackRequest {
	id: string;
	amount: number;
	status: string;
	created: Date;
	is_high: boolean;
	updated: Date;
	user_id: string;
	currency: string;
	description: string;
	external_id: string;
	payer_email: string;
	merchant_name: string;
}

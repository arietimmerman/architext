---
sidebar: false
aside: false
---

<script setup>
import Diagram from '../.vitepress/components/Diagram.vue'
</script>


# Simple example

<Diagram size="large">[&lt;business:actor&gt; Customer]-[&lt;application:component&gt; HRM]-[&lt;application:process&gt; Administration]</Diagram>

# Advanced example

<Diagram size="large">[&lt;business:actor&gt; Customer]
[&lt;application:component&gt; Web Portal]
[&lt;application:component&gt; Authentication Service]
[&lt;application:component&gt; User Database]
[&lt;application:component&gt; API Gateway]
[&lt;application:component&gt; Notification Service]
[&lt;business:role&gt; Support Agent]
[&lt;business:process&gt; Order Processing]
[&lt;technology:device&gt; Load Balancer]
[&lt;technology:component&gt; Cloud Platform]
[Customer] -&gt; [Web Portal]
[Web Portal] --:&gt; [Authentication Service]
[Authentication Service] --&gt; [User Database]
[Web Portal] --:&gt; [API Gateway]
[API Gateway] -|&gt; [Order Processing]
[Order Processing] --|&gt; [Notification Service]
[Support Agent] .-. [Order Processing]
[API Gateway] o-&gt; [Load Balancer]
[Load Balancer] +-&gt; [Cloud Platform]
[Notification Service] - [Customer]</Diagram>

# Advanced example 2

<Diagram size="large">[&lt;business:actor&gt; Supplier]
[&lt;business:actor&gt; Customer]
[&lt;application:component&gt; Ordering System]
[&lt;application:component&gt; Inventory Management]
[&lt;application:component&gt; Billing Service]
[&lt;application:component&gt; Shipping Service]
[&lt;application:component&gt; CRM System]
[&lt;application:component&gt; Email Service]
[&lt;business:role&gt; Sales Representative]
[&lt;business:role&gt; Warehouse Staff]
[&lt;business:process&gt; Order Fulfillment]
[&lt;business:process&gt; Payment Processing]
[&lt;technology:device&gt; Server Cluster]
[&lt;technology:component&gt; Network Firewall]
[&lt;technology:component&gt; Cloud Storage]
[Supplier] -&gt; [Ordering System]
[Customer] -&gt; [Ordering System]
[Ordering System] --&gt; [Inventory Management]
[Ordering System] --&gt; [Billing Service]
[Billing Service] --&gt; [Payment Processing]
[Payment Processing] --&gt; [CRM System]
[Ordering System] --&gt; [Order Fulfillment]
[Order Fulfillment] --&gt; [Shipping Service]
[Shipping Service] --&gt; [Customer]
[Order Fulfillment] --&gt; [Warehouse Staff]
[CRM System] --&gt; [Sales Representative]
[Email Service] --&gt; [Customer]
[Inventory Management] --&gt; [Warehouse Staff]
[Ordering System] o-&gt; [Server Cluster]
[Server Cluster] +-&gt; [Network Firewall]
[Network Firewall] +-&gt; [Cloud Storage]</Diagram>


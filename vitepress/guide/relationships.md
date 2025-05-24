<script setup>
import Diagram from '../.vitepress/components/Diagram.vue'
</script>

# Relationship

## Specialization

Relationships are depicted with <code>-:&gt;</code> or <code>&lt;:-</code>. For example:

<Diagram>[&lt;business:actor&gt; Manager] -:&gt; [&lt;business:actor&gt; Employee]</Diagram>

## Composition

Composition relations are depicted with <code>+-</code> or <code>-+</code>. For example:

<Diagram>[&lt;application:component&gt; Payroll System] +- [&lt;application:function&gt; Salary Calculation]</Diagram>

## Aggregation

Aggregation relationships are shown with <code>o-</code> or <code>-o</code>. For example:

<Diagram>[&lt;business:collaboration&gt; Project Team] o- [&lt;business:actor&gt; Developer]</Diagram>

## Assignments

Assignments are just <code>.--.</code>. For example:

<Diagram>[&lt;application:component&gt; HRM] .--. [&lt;application:function&gt; Employee Management]</Diagram>

## Realization

<code>--:&gt;</code> For example:

<Diagram>[&lt;application:service&gt; Reporting Service] --:&gt; [&lt;application:function&gt; Generate Report]</Diagram>

## Triggering

<code>-|&gt;</code> For example:

<Diagram>[&lt;business:event&gt; Leave Request Submitted] -|&gt; [&lt;business:process&gt; Approve Leave]</Diagram>

## Serving

<code>-&gt;</code> For example:

<Diagram>[&lt;application:service&gt; Authentication Service] -&gt; [&lt;business:actor&gt; Employee]</Diagram>

## Flow

<Diagram>[&lt;business:process&gt; Invoice Processing] --|&gt; [&lt;business:event&gt; Payment Received]</Diagram>

## Access

<Diagram>[&lt;application:function&gt; Document Management] --&gt; [&lt;business:data&gt; Contract]</Diagram>

## Association

<Diagram>[&lt;business:role&gt; Sales Representative] - [&lt;business:object&gt; Customer Record]</Diagram>